const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

// Stored nodes and search queries need different task types for best
// retrieval quality, per Gemini embedding docs.
export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function embed(
  text: string,
  taskType: EmbeddingTaskType,
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (add it to .env)");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini embedContent failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding: { values: number[] } };
  // At output_dimensionality < 3072 Gemini returns non-normalized vectors;
  // cosine similarity in pgvector assumes comparable magnitudes, so normalize.
  return normalize(data.embedding.values);
}

function normalize(vector: number[]): number[] {
  const norm = Math.hypot(...vector);
  return vector.map((x) => x / norm);
}
