"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { CommandBlock } from "./command-block";
import { Button, Field, Label } from "./ui";
import { GEMINI_KEY_CONSOLE, serverUrl, type GeminiKeySource } from "@/lib/api";

// The three step bodies. The orchestrator in app/onboarding/page.tsx owns the
// state, the network and the navigation; these only render and report changes.

const AGENTS = ["claude-code", "codex", "other"] as const;
export type Agent = (typeof AGENTS)[number];

export const PROFILE_QUESTIONS = ["q1", "q2", "q3", "q4"] as const;
export type Answers = Record<(typeof PROFILE_QUESTIONS)[number], string>;

// Step 1. One question per view, each with a real example in the placeholder,
// because a blank field with an abstract label produces a blank profile.
export function ProfileStep({
  index,
  answers,
  profile,
  onAnswer,
  onProfile,
}: {
  /** 0 to 3 asks a question, 4 shows the assembled text. */
  index: number;
  answers: Answers;
  profile: string;
  onAnswer: (key: keyof Answers, value: string) => void;
  onProfile: (value: string) => void;
}) {
  const t = useTranslations("onboarding.profile");

  if (index < PROFILE_QUESTIONS.length) {
    const key = PROFILE_QUESTIONS[index];
    return (
      // One question per view only works if the question IS the view. As an 11px
      // label beside a 17px input it was the smallest thing on an empty screen.
      <div>
        <h1 className="max-w-[24ch] text-title">{t(`${key}.question`)}</h1>
        <input
          id={key}
          autoFocus
          value={answers[key]}
          onChange={(e) => onAnswer(key, e.target.value)}
          placeholder={t(`${key}.hint`)}
          className="mt-7 w-full max-w-[620px] border-b border-edge bg-transparent pb-4 text-lead text-ink outline-none transition-colors duration-state placeholder:text-ink-3 focus:border-thread"
        />
        <p className="pt-4 text-small text-ink-3">{t("optionalAnswer")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="max-w-[24ch] text-title">{t("title")}</h1>
      <div className="pt-7">
        <Label htmlFor="profile">{t("resultLabel")}</Label>
      </div>
      <div className="pt-3">
        <textarea
          id="profile"
          rows={7}
          // The server caps a profile at 4000 characters, so the field stops there
          // rather than letting someone write past a rejection.
          maxLength={4000}
          value={profile}
          onChange={(e) => onProfile(e.target.value)}
          className="w-full resize-y rounded-control border border-edge bg-plaster-raised px-5 py-4 text-body text-ink outline-none transition-colors duration-state focus:border-thread"
          style={{ maxWidth: "68ch" }}
        />
      </div>
      <p className="max-w-[68ch] pt-5 text-small text-ink-2">{t("note")}</p>
    </div>
  );
}

// Step 2. The one thing on this screen that is not about the person or their
// project: without a key to Google, Ariadne cannot embed an entry or answer a
// question, and finding that out later on a chat that says nothing is the worst
// possible way to learn it.
//
// The only step with no way past it. Every call to Google is paid for by the
// account that made it, so an account without a key is an account that cannot
// write an entry or run a search - and walking someone through the rest of the
// wizard first would only move the wall further from the thing that explains it.
export function KeyStep({
  value,
  source,
  error,
  onChange,
}: {
  value: string;
  /** Whether this account already has a working key, in which case typing is optional. */
  source: GeminiKeySource;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("onboarding.key");

  return (
    <div>
      <h1 className="max-w-[24ch] text-title">{t("title")}</h1>
      <p className="max-w-[62ch] pt-5 text-body text-ink-2">{t(`lead.${source}`)}</p>
      <input
        id="gemini-key"
        type="password"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("hint")}
        className="mt-7 w-full max-w-[620px] border-b border-edge bg-transparent pb-4 text-lead text-ink outline-none transition-colors duration-state placeholder:text-ink-3 focus:border-thread"
      />
      {error ? <p className="max-w-[62ch] pt-4 text-small text-iron">{error}</p> : null}
      <p className="max-w-[62ch] pt-4 text-small text-ink-3">
        {t(source === "user" ? "keptIfEmpty" : "required")}
      </p>
      <a
        href={GEMINI_KEY_CONSOLE}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-block text-small text-thread underline underline-offset-2"
      >
        {t("where")}
      </a>
    </div>
  );
}

export type Card = {
  name: string;
  repoRef: string;
  stack: string;
  etap: string;
  ograniczenia: string;
};

const ETAPY = ["prototyp", "produkcja", "utrzymanie"] as const;

/** Used when the repository field is left empty, and by the screen that says so. */
export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projekt"
  );
}

/**
 * What the backend will actually store, and therefore the only string a coder
 * can use to find this project. Shown on screen, because the day it is wrong is
 * the day nothing works and there is nothing on any screen to compare against.
 */
export function effectiveRepoRef(card: Pick<Card, "name" | "repoRef">): string {
  return card.repoRef.trim() || `local/${slug(card.name)}`;
}

// Step 2. Only the name is required, and the fields say so themselves rather
// than leaving it to an asterisk nobody reads.
//
// The repository field is the one with consequences beyond this screen. It is
// the address a coder reports from the directory it runs in, and the archive is
// found by matching the two: the project's name plays no part in it. Left empty
// it becomes local/<name>, which works, but only for a coder that was told that
// exact string. All of which is invisible unless the screen says it, so it does.
export function ProjectStep({
  card,
  error,
  heading,
  onChange,
}: {
  card: Card;
  error: string | null;
  /** The caller's words: this form asks the same questions on day one and a
   *  year in, and only the sentence above them differs. */
  heading: string;
  onChange: (patch: Partial<Card>) => void;
}) {
  const t = useTranslations("onboarding.project");
  const typed = card.repoRef.trim();

  return (
    <div>
      <h1 className="text-title">{heading}</h1>
      <p className="max-w-[64ch] pt-5 text-body text-ink-2">{t("repoLead")}</p>
      <div className="mt-7 divide-y divide-hairline border-y border-hairline">
      <Field
        id="name"
        label={t("label.name")}
        placeholder={t("hint.name")}
        value={card.name}
        onChange={(e) => onChange({ name: e.target.value })}
        note={t("required")}
        error={error ?? undefined}
        autoFocus
      />
      <Field
        id="repoRef"
        label={t("label.repo")}
        placeholder={t("hint.repo")}
        value={card.repoRef}
        onChange={(e) => onChange({ repoRef: e.target.value })}
        // Not "optional" any more. Empty is allowed, but it is a choice with a
        // consequence, and the note names the string that choice produces.
        note={
          typed
            ? t("repoNote.set")
            : t("repoNote.fallback", { ref: effectiveRepoRef(card) })
        }
      />
      <Field
        id="stack"
        label={t("label.stack")}
        placeholder={t("hint.stack")}
        value={card.stack}
        onChange={(e) => onChange({ stack: e.target.value })}
        note={t("optional")}
      />
      <Field id="etap" label={t("label.etap")}>
        {/* One per line rather than three across. The options used to be single
            words - "produkcja" reads as "being produced" as easily as "live",
            and "utrzymanie" says nothing at all to someone who has not met the
            term - so each now carries the sentence that distinguishes it, and
            three sentences side by side is not a row. */}
        <div role="radiogroup" aria-labelledby="etap" className="flex flex-col gap-3 py-3">
          {ETAPY.map((etap) => (
            <label key={etap} className="flex cursor-pointer items-center gap-3 text-body">
              <input
                type="radio"
                name="etap"
                value={etap}
                checked={card.etap === etap}
                onChange={() => onChange({ etap })}
                className="accent-thread"
              />
              {t(`etapChoice.${etap}`)}
            </label>
          ))}
        </div>
      </Field>
      <Field id="ograniczenia" label={t("label.limits")}>
        <GuardrailsField
          value={card.ograniczenia}
          onChange={(ograniczenia) => onChange({ ograniczenia })}
        />
      </Field>
      </div>
    </div>
  );
}

// The whole request body caps at 64 KB on the server, and the rest of the card
// travels in the same one. Half of that is a generous ceiling for a rules file
// and leaves room for everything else; anything larger is a document, not a set
// of constraints, and belongs in the repository the coder is already reading.
const MAX_GUARDRAILS_BYTES = 32 * 1024;

/**
 * Type the constraints, or hand over the file they are already written in.
 *
 * The file is read here and its text goes into the same field, so nothing is
 * uploaded and nothing is stored anywhere new: what the coder reads is the same
 * paragraph either way. Plenty of teams keep this as a CONVENTIONS.md or a
 * guardrails file already, and retyping it is how it ends up out of date.
 */
function GuardrailsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("onboarding.project");
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const load = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > MAX_GUARDRAILS_BYTES) {
      setError(t("limits.tooBig", { kb: String(Math.round(MAX_GUARDRAILS_BYTES / 1024)) }));
      return;
    }
    let text: string;
    try {
      text = (await file.text()).trim();
    } catch {
      setError(t("limits.unreadable"));
      return;
    }
    if (!text) {
      setError(t("limits.empty"));
      return;
    }
    // Added to what is there rather than over it: someone who typed two lines
    // and then remembered the file meant both.
    const existing = value.trim();
    onChange(existing ? `${existing}\n\n${text}` : text);
    // Cleared so picking the same file twice, after an edit, still fires change.
    if (picker.current) picker.current.value = "";
  };

  return (
    <div className="py-3">
      <textarea
        id="ograniczenia"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("hint.limits")}
        className="w-full resize-y bg-transparent text-body leading-7 text-ink outline-none placeholder:text-ink-3/70"
      />
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Button type="button" variant="secondary" onClick={() => picker.current?.click()}>
          {t("limits.fromFile")}
        </Button>
        <p className="text-small text-ink-3">{t("limits.note")}</p>
      </div>
      {/* Hidden because the native control cannot be styled and says "no file
          chosen" forever; the button above is the whole interface. */}
      <input
        ref={picker}
        type="file"
        accept=".md,.txt,.mdc,.cursorrules,text/plain,text/markdown"
        hidden
        onChange={(e) => void load(e.target.files?.[0])}
      />
      {error ? <p className="pt-3 text-small text-iron">{error}</p> : null}
    </div>
  );
}

// Step 3. Claude Code gets a command; the others get the same token with an
// honest sentence saying there is no ready-made command for them.
export function AgentStep({
  agent,
  token,
  failed,
  repoRef,
  onAgent,
  onRegenerate,
}: {
  agent: Agent;
  token: string | null;
  failed: boolean;
  /** What the project was filed under, which is what the coder has to send back. */
  repoRef: string;
  onAgent: (agent: Agent) => void;
  onRegenerate: () => void;
}) {
  const t = useTranslations("onboarding.agent");
  const host = serverUrl.replace(/\/$/, "");

  return (
    <div>
      <h1 className="text-title">{t("title")}</h1>
      <div className="mt-7 border-y border-hairline">
        <Field id="agent" label={t("label")}>
          <div role="radiogroup" aria-labelledby="agent" className="flex flex-wrap gap-6 py-3">
            {AGENTS.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-3 text-body">
                <input
                  type="radio"
                  name="agent"
                  value={option}
                  checked={agent === option}
                  onChange={() => onAgent(option)}
                  className="accent-thread"
                />
                {t(`option.${option}`)}
              </label>
            ))}
          </div>
        </Field>
      </div>

      {/* Two things that only become wrong later, said before the command
          rather than after it fails.

          The first is that --scope user registers this once for the whole
          machine. Standing inside a per-project wizard, the command reads as
          something to repeat for every project, and the second attempt answers
          "already exists in user config" - which looks like a refusal to have
          more than one project, and is in fact the opposite.

          The second is the address: a coder reports the directory it was
          started in, and if that is not this project's, the archive it finds is
          a different one or none at all. */}
      <div className="mt-7 rounded-control border border-edge/60 bg-plaster-sunk p-5">
        <p className="max-w-[68ch] text-small text-ink">{t("onceOnly")}</p>
        <p className="max-w-[68ch] pt-3 text-small text-ink">{t("whereToRun")}</p>
        <p className="pt-3 font-mono text-data text-ink-2">{repoRef}</p>
        <p className="max-w-[68ch] pt-3 text-small text-ink-2">{t("mustMatch")}</p>
      </div>

      <div className="pt-6">
        {failed || !token ? (
          <div>
            <p className="max-w-[68ch] text-small text-iron">{t("tokenFailed")}</p>
            <div className="pt-5">
              <Button variant="secondary" onClick={onRegenerate}>
                {t("regenerate")}
              </Button>
            </div>
          </div>
        ) : agent === "claude-code" ? (
          <CommandBlock
            command={`claude mcp add --scope user --transport http ariadne ${host}/mcp --header "Authorization: Bearer ${token}"`}
            what={t("what")}
            where={t("where")}
            warn={t("tokenOnce")}
          />
        ) : (
          <div>
            <p className="max-w-[68ch] text-small text-ink-2">{t("other.note", { url: `${host}/mcp` })}</p>
            <CommandBlock
              command={token}
              what={t("tokenWhat")}
              where={t("tokenWhere")}
              warn={t("tokenOnce")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
