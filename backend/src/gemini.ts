const EMBEDDING_MODEL = "gemini-embedding-001";
// The cheap model. Both chat endpoints use it: one to write a paragraph over
// retrieved nodes, the other to turn a sentence into proposed edits. Neither is
// reasoning work.
//
// Plan section 12 named gemini-2.5-flash-lite, which the API now refuses for
// new keys ("no longer available to new users") while still listing it. Pinned
// to a version rather than the -latest alias, so the answers do not change
// shape underneath us on Google's schedule.
const CHAT_MODEL = "gemini-3.5-flash-lite";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export const EMBEDDING_DIMENSIONS = 768;

// Stored nodes and search queries need different task types for best
// retrieval quality, per Gemini embedding docs.
export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

// The key is an argument, not something this module reads for itself: it is the
// caller's account that pays for the call, and only the service layer knows
// whose account that is. Where it comes from - the person's own key or the
// server's - is decided in one place there.
async function call(
  key: string,
  model: string,
  method: string,
  body: unknown,
  query = "",
): Promise<Response> {
  const res = await fetch(`${API}/${model}:${method}${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${method} failed: ${res.status} ${await res.text()}`);
  return res;
}

export async function embed(
  key: string,
  text: string,
  taskType: EmbeddingTaskType,
): Promise<number[]> {
  const res = await call(key, EMBEDDING_MODEL, "embedContent", {
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  });

  const data = (await res.json()) as { embedding: { values: number[] } };
  // At output_dimensionality < 3072 Gemini returns non-normalized vectors;
  // cosine similarity in pgvector assumes comparable magnitudes, so normalize.
  return normalize(data.embedding.values);
}

type Prompt = { system: string; user: string };

const contents = ({ system, user }: Prompt) => ({
  systemInstruction: { parts: [{ text: system }] },
  contents: [{ role: "user", parts: [{ text: user }] }],
});

// Yields the answer in pieces as the model writes it. The assistant screen shows
// a paragraph over retrieved entries, and waiting for the last word before
// showing the first is the difference between "thinking" and "hung".
export async function* generateStream(key: string, prompt: Prompt): AsyncGenerator<string> {
  const res = await call(key, CHAT_MODEL, "streamGenerateContent", contents(prompt), "?alt=sse");
  if (!res.body) throw new Error("Gemini streamGenerateContent returned no body");

  // SSE frames are separated by a blank line and can be split across reads, so
  // the tail of a partial frame is carried into the next one.
  //
  // The line ending is CRLF, not LF. Splitting on "\n\n" finds nothing in
  // "\r\n\r\n" and the whole stream silently accumulates in the buffer: no
  // frames, no text, no error. Hence the regex on both ends.
  const decoder = new TextDecoder();
  let buffer = "";

  const framesIn = function* (text: string) {
    buffer += text;
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) yield frame;
  };

  const textIn = (frame: string): string => {
    const line = frame.split(/\r?\n/).find((l) => l.startsWith("data: "));
    if (!line) return "";
    const payload = line.slice(6);
    // The stream ends with a literal [DONE] in some deployments, which is not
    // JSON and must not take the whole answer down with it.
    if (payload === "[DONE]") return "";
    return textOf(JSON.parse(payload));
  };

  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    for (const frame of framesIn(decoder.decode(chunk, { stream: true }))) {
      const text = textIn(frame);
      if (text) yield text;
    }
  }

  // A last frame with no trailing blank line never reached the loop above.
  const text = buffer.trim() ? textIn(buffer) : "";
  if (text) yield text;
}

// One shot, no streaming, and the answer has to parse: the database editor turns
// a sentence into a list of proposed changes, and half a JSON object is not a
// smaller list, it is a broken one.
export async function generateJson<T>(key: string, prompt: Prompt, schema: object): Promise<T> {
  const res = await call(key, CHAT_MODEL, "generateContent", {
    ...contents(prompt),
    generationConfig: { responseMimeType: "application/json", responseSchema: schema },
  });
  const text = textOf(await res.json());
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text) as T;
}

export const SUMMARY_WORDS = 10;

const SUMMARY_RULES = [
  `You title one recorded entry in at most ${SUMMARY_WORDS} words.`,
  // No language is named. Naming one, in either direction, was read as a
  // preference for it: with Polish in the rule an English entry came back
  // titled in Polish.
  "The title must be in the same language as the entry. Never translate it into another language.",
  // A phrase, not a sentence. Asked for a sentence the model writes a reason
  // clause it has no room to finish, and the cap then cuts it off after "due
  // to". A phrase that runs long is still a phrase.
  "Write a phrase naming what was decided or found, never a full sentence and never a subordinate clause.",
  "Drop the reason, the caveats and the detail: the entry itself is one click away.",
  "Say the thing, not that it was recorded: never open with 'entry about' or 'note on'.",
  "No final full stop, no quotes, no markdown.",
].join(" ");

/**
 * Ten words over one entry. Asked for as JSON rather than as a bare line
 * because a model told to be brief in prose still opens with "Sure, here is",
 * and a schema leaves it nowhere to put that.
 *
 * The word cap is also enforced here: the instruction is a request, the slice
 * is the guarantee, and a card whose lead line wraps to three rows is the thing
 * this feature exists to prevent.
 */
export async function summarize(key: string, content: string): Promise<string> {
  const { summary } = await generateJson<{ summary: string }>(
    key,
    { system: SUMMARY_RULES, user: content },
    { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  );
  return summary.trim().split(/\s+/).slice(0, SUMMARY_WORDS).join(" ");
}

function textOf(payload: unknown): string {
  const parts = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    .candidates?.[0]?.content?.parts;
  return parts?.map((p) => p.text ?? "").join("") ?? "";
}

function normalize(vector: number[]): number[] {
  const norm = Math.hypot(...vector);
  return vector.map((x) => x / norm);
}
