// Smoke check for src/gemini.ts: run from backend/ with `npx tsx scripts/check-embedding.ts`
import { embed, EMBEDDING_DIMENSIONS } from "../src/gemini.js";

process.loadEnvFile("../.env");

const vector = await embed("hello from Ariadne", "RETRIEVAL_DOCUMENT");
const norm = Math.hypot(...vector);

console.log(`dimensions: ${vector.length}, norm: ${norm.toFixed(6)}`);
if (vector.length !== EMBEDDING_DIMENSIONS) throw new Error("wrong dimensionality");
if (Math.abs(norm - 1) > 1e-6) throw new Error("vector not normalized");
console.log("OK");
