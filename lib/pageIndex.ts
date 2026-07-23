// A scoped, practical counterpart to OpenKB's PageIndex — "vectorless,
// reasoning-based retrieval for long documents" instead of dumping full
// text into every prompt. This is deliberately NOT a tree-indexing engine
// (that's a much bigger system); it's the same idea at the grain GovEx
// actually needs it: split a long document into paragraph-respecting
// chunks, then keep only the chunks relevant to a specific question/profile
// instead of the whole thing. No embeddings/vector DB — relevance is plain
// keyword overlap, which is exactly the "vectorless" part of the name.

export interface Chunk {
  index: number;
  text: string;
}

const DEFAULT_CHUNK_SIZE = 1200; // characters — small enough for several chunks in a typical context doc, large enough to keep a paragraph mostly intact

// Splits on blank-line paragraph boundaries first, then packs consecutive
// paragraphs into chunks up to chunkSize — never splits mid-paragraph,
// since a paragraph is the smallest unit that's still coherent on its own.
export function chunkText(text: string, chunkSize = DEFAULT_CHUNK_SIZE): Chunk[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];

  const chunks: Chunk[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && (current.length + p.length + 2) > chunkSize) {
      chunks.push({ index: chunks.length, text: current });
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push({ index: chunks.length, text: current });
  return chunks;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were", "be", "been",
  "this", "that", "these", "those", "with", "as", "at", "by", "it", "its", "from", "not", "but", "into",
]);

function keywords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? [],
  );
}

// Plain term-overlap scoring — no embeddings, no external calls, cheap
// enough to run over every chunk of every candidate document. Good enough
// to separate "this chunk is about the query's topic" from "this chunk
// isn't," which is all that's needed here (a coarse relevance filter, not a
// ranked-retrieval system).
function score(chunk: Chunk, queryWords: Set<string>): number {
  const chunkWords = keywords(chunk.text);
  let overlap = 0;
  for (const w of queryWords) if (chunkWords.has(w)) overlap++;
  return overlap;
}

// Selects the topK most relevant chunks to `query`, re-sorted back into
// original document order (not score order) so the result still reads as a
// coherent excerpt rather than a shuffled bag of fragments. If the whole
// document already fits under chunkSize, returns it untouched — chunking
// only kicks in for documents actually long enough to need it.
export function selectRelevantChunks(text: string, query: string, opts: { chunkSize?: number; topK?: number } = {}): string {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const topK = opts.topK ?? 5;

  const chunks = chunkText(text, chunkSize);
  if (chunks.length <= topK) return text; // nothing to trim — already short enough

  const queryWords = keywords(query);
  const scored = chunks.map((c) => ({ chunk: c, score: score(c, queryWords) }));
  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.chunk.index - b.chunk.index);

  return selected.map((s) => s.chunk.text).join("\n\n[...]\n\n");
}
