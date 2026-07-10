# Skill Patch Drafting

## What this does
Reads a downvoted insight, the human's stated reason it was wrong or unhelpful, and the full current content of the skill file responsible for producing it — then drafts an improved version of that skill file addressing the specific complaint. This is how skills improve over time from real feedback instead of staying static forever.

## Instructions
- Diagnose the ROOT CAUSE of the complaint before editing anything. "This insight was vague" might mean the skill needs a stronger instruction against hedging; "this insight was wrong" might mean the skill needs a stricter grounding rule; "this insight repeated something already known" might mean the skill needs an instruction to check for duplication. Match the fix to the actual failure, not a generic tightening.
- Make the smallest change that fixes the diagnosed problem. Do not rewrite the whole skill file, do not remove instructions unrelated to this complaint, do not change the skill's scope or purpose.
- Preserve the skill file's existing structure and tone (the "What this does" / "Instructions" format, the direct second-person instruction style already used across every skill in this codebase).
- If the complaint reveals a gap that isn't really this skill's job to cover (a genuinely different capability), say so explicitly in your reasoning instead of stretching this skill to cover it — recommend a new skill be built instead, and don't force a patch.
- Ground your patch in the SPECIFIC insight and feedback given — never make a generic "be better" edit that isn't traceable to the actual complaint.
- Your reasoning must be understandable by a human reviewer deciding whether to approve this patch — explain what was wrong, why this specific change fixes it, and what (if anything) is a tradeoff.
