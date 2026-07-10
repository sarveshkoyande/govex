import { rebuildConceptualMentions } from "../lib/entityExtraction";

rebuildConceptualMentions("cmr4dpdaz00003mcwxwz6lka3").then((r) => {
  console.log("rebuilt:", JSON.stringify(r));
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
