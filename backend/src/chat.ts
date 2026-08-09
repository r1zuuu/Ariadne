import { generateJson, generateStream } from "./gemini.js";
import {
  ServiceError,
  conflictsOf,
  createNode,
  geminiKey,
  requestDelete,
  requestUpdate,
  searchNodes,
} from "./service.js";

// The two conversational endpoints. Both are the same shape underneath: retrieve
// the entries a sentence is about, then hand them to the cheap model.
//
// The editor still goes through createNode, requestUpdate and requestDelete
// rather than writing rows itself, so every rule about validation, ownership
// and provenance is enforced in one place. What it does not do any more is
// queue the result: the person asking for the change is looking at the screen,
// so it happens, and what comes back says what was recorded.

const MAX_MESSAGE = 2000;
const RETRIEVED = 5;

type Retrieved = Awaited<ReturnType<typeof searchNodes>>[number];

function assertMessage(message: string) {
  if (!message?.trim()) throw new ServiceError("validation", "message must not be empty");
  if (message.length > MAX_MESSAGE) {
    throw new ServiceError("validation", `message must be at most ${MAX_MESSAGE} characters`);
  }
}

// Numbered, because the answer cites by number and the app resolves the number
// back to a row. Dates are spelled out: "the entry from 21 July" is the citation
// a person checks, an id is not.
//
// The metadata sits on its own bracketed line and the content is fenced. Run
// together on one line, the editor copied the metadata into the rewritten
// content as if it were the entry's first sentence.
function asContext(found: Retrieved[]): string {
  return found
    .map((node, i) => {
      const when = new Date(node.createdAt).toISOString().slice(0, 10);
      const where = node.anchors?.map((a) => a.path).join(", ");
      return [
        `[${i + 1}] (${node.type}, ${node.status}, ${when}${where ? `, files: ${where}` : ""})`,
        "<<<",
        node.content,
        ">>>",
      ].join("\n");
    })
    .join("\n\n");
}

const ANSWER_RULES = [
  // First and repeated, because it was being dropped exactly where it matters
  // most: on "the entries do not cover this", the model followed the language of
  // these instructions instead of the language of the question.
  "Always write in the same language as the question. A Polish question gets a Polish answer, including when the answer is that you do not know.",
  "You answer questions about a project's recorded history from the entries given to you.",
  "Use only those entries. If they do not cover the question, say so in one sentence, in the question's language, and stop.",
  "Cite with the bracketed number of the entry you used, like [2], right after the claim it supports.",
  "Be short. Two or three sentences unless the question genuinely needs more.",
  "Never invent a date, a file path or a decision that is not in the entries.",
].join(" ");

// Yields the sources first and then the answer in pieces. Sources go first on
// purpose: the screen can render what it is about to answer from before a single
// word arrives, and a stream that dies halfway still leaves the citations.
export async function* answerQuestion(input: {
  userId: string;
  projectId: string;
  question: string;
}): AsyncGenerator<
  { type: "sources"; sources: Retrieved[] } | { type: "delta"; text: string }
> {
  assertMessage(input.question);
  // searchNodes checks ownership, so an unauthorised project fails here rather
  // than after the model has been paid for a paragraph.
  const found = await searchNodes({
    userId: input.userId,
    projectId: input.projectId,
    query: input.question,
    k: RETRIEVED,
  });

  yield { type: "sources", sources: found };

  if (!found.length) return;

  for await (const text of generateStream(await geminiKey(input.userId), {
    system: ANSWER_RULES,
    user: `Entries:\n\n${asContext(found)}\n\nQuestion: ${input.question}`,
  })) {
    yield { type: "delta", text };
  }
}

const EDIT_RULES = [
  "You turn one sentence from a person into changes to their project's recorded entries.",
  "You are given the entries that sentence is most likely about, numbered.",
  "Each entry has a bracketed metadata line and then its content between <<< and >>>.",
  "The metadata line and the <<< >>> markers are never part of the content and must never appear in a value you write.",
  "Propose 'update' only when the person is correcting or rewording an existing entry: repeat its number and give the full new content, not a diff.",
  "Propose 'delete' when they say something is no longer true or should go away.",
  "Propose 'create' when they are telling you something new that is not in the entries.",
  "Propose nothing at all when the sentence is a question or small talk; say so in the reply instead.",
  "Never propose more than one change per entry.",
  "Write the reply in the language the person used, one sentence, saying what you are proposing and why.",
].join(" ");

const EDIT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["update", "delete", "create"] },
          // 1-based index into the entries above; absent for 'create'.
          entry: { type: "integer" },
          content: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  required: ["reply", "proposals"],
} as const;

type Proposal = { action: "update" | "delete" | "create"; entry?: number; content?: string };

export async function proposeEdits(input: {
  userId: string;
  projectId: string;
  message: string;
  sessionId: string;
}) {
  assertMessage(input.message);
  const found = await searchNodes({
    userId: input.userId,
    projectId: input.projectId,
    query: input.message,
    k: RETRIEVED,
  });

  const answer = await generateJson<{ reply: string; proposals: Proposal[] }>(
    await geminiKey(input.userId),
    {
      system: EDIT_RULES,
      user: found.length
        ? `Entries:\n\n${asContext(found)}\n\nThe person says: ${input.message}`
        : `There are no entries yet.\n\nThe person says: ${input.message}`,
    },
    EDIT_SCHEMA,
  );

  const queued = [];
  for (const proposal of answer.proposals ?? []) {
    // The model hands back a number it was given; anything else is a
    // hallucinated reference and is dropped rather than guessed at.
    const target = proposal.entry ? found[proposal.entry - 1] : undefined;

    if (proposal.action === "create" && proposal.content?.trim()) {
      const created = await createNode({
        userId: input.userId,
        projectId: input.projectId,
        type: "note",
        content: proposal.content.trim(),
        source: { session_id: input.sessionId, channel: "app_chat" },
      });
      // Written by the person in front of the screen, so it is recorded rather
      // than queued. What it may contradict travels with it: this is the one
      // moment the writer is here to say which of the two entries stands.
      queued.push({
        action: "create" as const,
        nodeId: created.nodeId,
        content: proposal.content.trim(),
        conflicts: await conflictsOf(input.userId, created.conflictsWith),
      });
      continue;
    }

    if (!target) continue;

    if (proposal.action === "update" && proposal.content?.trim()) {
      // Content only, no anchors key: the editor rewrites prose and is never
      // shown the anchors, and an absent key leaves the node's own untouched.
      const result = await requestUpdate({
        userId: input.userId,
        nodeId: target.id,
        content: proposal.content.trim(),
        requestedBy: "app_agent",
      });
      queued.push({ action: "update" as const, nodeId: target.id, content: proposal.content.trim(), ...result });
    }

    if (proposal.action === "delete") {
      const result = await requestDelete({
        userId: input.userId,
        nodeId: target.id,
        requestedBy: "app_agent",
      });
      queued.push({ action: "delete" as const, nodeId: target.id, content: target.content, ...result });
    }
  }

  return { reply: answer.reply, sources: found, queued };
}
