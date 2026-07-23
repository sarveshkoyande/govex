// A real counterpart to OpenKB's PageIndex — "vectorless, reasoning-based
// retrieval for long documents." This builds an actual hierarchical tree
// over a document (sections/subsections, not a flat chunk list) and
// retrieves by TRAVERSING that tree: a branch whose own heading + direct
// text has no relevance signal to the query gets pruned — and everything
// beneath it is skipped without ever being individually scored, the same
// way a human skimming a table of contents skips a whole chapter they can
// tell isn't relevant rather than reading every paragraph in it. No
// embeddings/vector DB anywhere — relevance is keyword overlap, which is
// the actual "vectorless" part of the name.

export interface DocSection {
  title: string; // "Document" for the synthetic root; the literal heading line otherwise
  level: number; // 0 = root, 1 = top-level section, 2 = subsection
  ownText: string; // text directly under this heading, NOT including subsection text
  children: DocSection[];
}

// Tuned to the numbered-section style GovEx's own context docs actually use
// in practice ("1. Executive summary", "5.1 Integration operating model")
// rather than requiring real Markdown headings, since ingested text (mammoth-
// extracted docx, plain-text emails) never has Markdown syntax.
const TOP_LEVEL_HEADING = /^(\d+)\.\s+([A-Z][^\n]{2,80})$/;
const SUB_LEVEL_HEADING = /^(\d+)\.(\d+)\s+([A-Z][^\n]{2,80})$/;

// Parses a document into a section tree. A document with no detected
// headings (most raw meeting notes/emails — they're short enough not to
// need this in the first place) comes back as a bare root with all its
// text in `ownText` and no children; selectRelevantSections handles that
// case by falling back to returning the text untouched.
export function buildDocumentTree(text: string): DocSection {
  const root: DocSection = { title: "Document", level: 0, ownText: "", children: [] };
  const stack: DocSection[] = [root];
  let buffer: string[] = [];

  function flush() {
    const content = buffer.join("\n").trim();
    if (content) {
      const top = stack[stack.length - 1];
      top.ownText = top.ownText ? `${top.ownText}\n\n${content}` : content;
    }
    buffer = [];
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const subMatch = line.match(SUB_LEVEL_HEADING);
    const topMatch = !subMatch && line.match(TOP_LEVEL_HEADING);
    if (subMatch || topMatch) {
      flush();
      const level = subMatch ? 2 : 1;
      const node: DocSection = { title: line, level, ownText: "", children: [] };
      // Standard heading-stack algorithm: pop back to the nearest ancestor
      // shallower than this heading, then attach here.
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else {
      buffer.push(rawLine);
    }
  }
  flush();
  return root;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were", "be", "been",
  "this", "that", "these", "those", "with", "as", "at", "by", "it", "its", "from", "not", "but", "into",
]);

function keywords(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? []);
}

function relevance(text: string, queryWords: Set<string>): number {
  const textWords = keywords(text);
  let overlap = 0;
  for (const w of queryWords) if (textWords.has(w)) overlap++;
  return overlap;
}

// The actual tree traversal. At each node, score ONLY that node's own
// heading + direct text (never the full subtree) against the query.
//
// Descent is unconditional — every node's children get visited regardless
// of whether the PARENT itself scored — only the score decides INCLUSION
// (whether that node's own text makes it into the result), not whether to
// descend further. A stricter version that also prunes descent (skip a
// branch's children whenever the branch itself scores 0) was tried first
// and caught a real miss in testing: a generically-titled parent section
// ("5. The integration theme inside GovEx") scored 0 even though its child
// subsection ("5.3 The seven workstreams: GTM, Revenue, Cost Synergies...")
// was an exact match for the query — strict-prune traversal skipped it
// entirely because it never got past the uninformative parent. At the
// scale GovEx's actual documents run (a handful of sections, not
// thousands), the efficiency win from skipping subtrees isn't worth that
// failure mode, so descent always happens; only which nodes' text gets
// included in the result is score-gated.
export function selectRelevantSections(root: DocSection, query: string, opts: { minScore?: number; maxSections?: number } = {}): string {
  const minScore = opts.minScore ?? 1;
  const maxSections = opts.maxSections ?? 6;

  // No headings detected at all — nothing to traverse, fall back to the
  // document's own text untouched (short-document case, the common one for
  // meeting notes/emails, which don't need trimming anyway).
  if (root.children.length === 0) return root.ownText;

  const queryWords = keywords(query);
  const selected: { path: string; text: string; score: number }[] = [];

  function visit(node: DocSection, pathPrefix: string[]) {
    for (const child of node.children) {
      const childScore = relevance(`${child.title}\n${child.ownText}`, queryWords);
      const path = [...pathPrefix, child.title];
      if (childScore >= minScore && child.ownText) {
        selected.push({ path: path.join(" > "), text: child.ownText, score: childScore });
      }
      visit(child, path); // always descend — see comment above
    }
  }
  visit(root, []);

  if (selected.length === 0) return ""; // every section pruned — genuinely nothing relevant found

  return selected
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections)
    .map((s) => `## ${s.path}\n${s.text}`)
    .join("\n\n");
}

// Convenience wrapper — parse + traverse in one call, with the same
// "already short enough, don't bother" early exit the old flat version had.
export function selectRelevantContent(text: string, query: string, opts: { minScore?: number; maxSections?: number } = {}): string {
  if (text.length < 2000) return text;
  const tree = buildDocumentTree(text);
  const result = selectRelevantSections(tree, query, opts);
  return result || text; // pruned everything (e.g. a bad/generic query) — safer to fall back to full text than return nothing
}
