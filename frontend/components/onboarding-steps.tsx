"use client";

import { useTranslations } from "next-intl";
import { openExternal } from "@/lib/desktop";
import { useRef, useState } from "react";
import { Button, Input, Select, Textarea, Label } from "./ui";
import {
  GEMINI_KEY_CONSOLE,
  serverUrl,
  type GeminiKeySource,
  type MyInvite,
  type Workspace,
} from "@/lib/api";

// The three step bodies. The orchestrator in app/onboarding/page.tsx owns the
// state, the network and the navigation; these only render and report changes.

import { SUPPORTED_AGENTS, type SupportedAgent, AgentSetupGuide } from "./agent-connect";

export const AGENTS = SUPPORTED_AGENTS;
export type Agent = SupportedAgent;

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
      <p className="measure pt-5 text-small text-ink-2">{t("note")}</p>
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
      <p className="measure pt-5 text-body text-ink-2">{t(`lead.${source}`)}</p>
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
      {error ? <p className="measure pt-4 text-small text-iron">{error}</p> : null}
      <p className="measure pt-4 text-small text-ink-3">
        {t(source === "user" ? "keptIfEmpty" : "required")}
      </p>
      <a
        href={GEMINI_KEY_CONSOLE}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          event.preventDefault();
          void openExternal(GEMINI_KEY_CONSOLE);
        }}
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
  /** Which archive to file it under. Empty means the account's own, which is
   *  what the wizard always means and what a single-archive account never sees. */
  workspaceId: string;
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
//
// The archive field is the other one, and it was missing entirely. A project
// went wherever the server put it when nobody said, which is the oldest
// membership, so a project meant for a team quietly became private and the team
// never saw an entry. A coder reaches every archive its owner belongs to, so
// this no longer decides whether it can be found - only who else can read it,
// which is a question the person answering it has to be asked.
export function ProjectStep({
  card,
  error,
  heading,
  onChange,
  workspaces = [],
}: {
  card: Card;
  error: string | null;
  /** The caller's words: this form asks the same questions on day one and a
   *  year in, and only the sentence above them differs. */
  heading: string;
  onChange: (patch: Partial<Card>) => void;
  /** Left out by the wizard, which runs before there is a second archive to
   *  choose between. One archive means no question, so no field. */
  workspaces?: Workspace[];
}) {
  const t = useTranslations("onboarding.project");
  const typed = card.repoRef.trim();

  return (
    <div>
      <h1 className="text-title">{heading}</h1>
      <p className="measure pt-3 text-body text-ink-2">{t("repoLead")}</p>

      <div className="mt-7 flex max-w-[640px] flex-col gap-6">
        <Input
          id="project-name"
          label={t("label.name")}
          placeholder={t("hint.name")}
          value={card.name}
          onChange={(e) => onChange({ name: e.target.value })}
          note={t("required")}
          error={error ?? undefined}
          autoFocus
        />

        <Input
          id="project-repoRef"
          label={t("label.repo")}
          placeholder={t("hint.repo")}
          value={card.repoRef}
          onChange={(e) => onChange({ repoRef: e.target.value })}
          note={
            typed
              ? t("repoNote.set")
              : t("repoNote.fallback", { ref: effectiveRepoRef(card) })
          }
        />

        {workspaces.length > 1 ? (
          <Select
            id="project-workspaceId"
            label={t("label.workspace")}
            note={t("workspaceNote")}
            value={card.workspaceId}
            options={workspaces.map((workspace) => ({
              value: workspace.id,
              label: workspace.name,
            }))}
            onChange={(val) => onChange({ workspaceId: val })}
          />
        ) : null}

        <Input
          id="project-stack"
          label={t("label.stack")}
          placeholder={t("hint.stack")}
          value={card.stack}
          onChange={(e) => onChange({ stack: e.target.value })}
          note={t("optional")}
        />

        <div>
          <Label className="pb-2.5">{t("label.etap")}</Label>
          <div role="radiogroup" aria-label={t("label.etap")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ETAPY.map((etap) => {
              const selected = card.etap === etap;
              const fullText = t(`etapChoice.${etap}`);
              const [title, ...descParts] = fullText.split(" - ");
              const desc = descParts.join(" - ");
              return (
                <label
                  key={etap}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-card border p-4 transition-all duration-state ${
                    selected
                      ? "border-thread/60 bg-thread/[0.07] shadow-sm shadow-thread/5"
                      : "border-edge/50 bg-surface/40 hover:border-edge hover:bg-surface/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-small font-medium ${selected ? "text-ink" : "text-ink-2 group-hover:text-ink"}`}>
                      {title}
                    </span>
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        selected ? "border-thread bg-thread" : "border-edge/80 bg-surface/80"
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <div className="h-1.5 w-1.5 rounded-full bg-void" />}
                    </div>
                  </div>
                  {desc && (
                    <span className="pt-2 text-data leading-relaxed text-ink-3">
                      {desc}
                    </span>
                  )}
                  <input
                    type="radio"
                    name="etap"
                    value={etap}
                    checked={selected}
                    onChange={() => onChange({ etap })}
                    className="sr-only"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <GuardrailsField
          value={card.ograniczenia}
          onChange={(ograniczenia) => onChange({ ograniczenia })}
        />
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
    <div>
      <Textarea
        id="project-ograniczenia"
        label={t("label.limits")}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("hint.limits")}
        error={error ?? undefined}
      />
      <div className="flex flex-wrap items-center gap-3 pt-2.5">
        <Button type="button" variant="secondary" size="sm" onClick={() => picker.current?.click()}>
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
    </div>
  );
}

/**
 * The other answer to step 3: no project of your own, a code from somebody who
 * already has one.
 *
 * This used to be a link to the settings screen sitting under the wizard's
 * actions, which reads as abandoning the step rather than answering it, so the
 * ordinary thing to do was to invent a project instead. That invented project
 * lands in the private archive with the same repository address as the team's
 * copy, and from then on the coder writes to whichever of the two its token
 * belongs to, silently.
 */
export function JoinStep({
  code,
  error,
  waiting,
  onCode,
  onAccept,
  onBack,
}: {
  code: string;
  error: string | null;
  /** Invitations the server already holds against this address. */
  waiting: MyInvite[];
  onCode: (value: string) => void;
  onAccept: (code: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations("onboarding.join");

  return (
    <div>
      <h1 className="max-w-[24ch] text-title">{t("title")}</h1>
      <p className="measure pt-5 text-body text-ink-2">
        {waiting.length ? t("leadWaiting") : t("lead")}
      </p>

      {/* An invitation written to this address is already here and takes one
          press. The teams screen has worked this way since it was built; this
          step did not, and asked a person to go and find a code the server had
          bound to their address and handed over on request. A code passed by
          hand still has to be typed, so the field stays, under the rule. */}
      {waiting.length ? (
        <ul className="flex flex-col gap-3 pt-7">
          {waiting.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-5"
            >
              <span className="min-w-0">
                <span className="block text-body text-ink">{invite.workspaceName}</span>
                {invite.invitedBy ? (
                  <span className="block pt-1 text-data text-ink-3">
                    {t("from", { who: invite.invitedBy })}
                  </span>
                ) : null}
              </span>
              <Button onClick={() => onAccept(invite.code)}>{t("accept")}</Button>
            </li>
          ))}
        </ul>
      ) : null}
      {waiting.length ? (
        <p className="border-t border-hairline pt-7 text-small font-medium text-ink">
          {t("orPaste")}
        </p>
      ) : null}
      <input
        id="invite-code"
        autoFocus={waiting.length === 0}
        autoComplete="off"
        spellCheck={false}
        value={code}
        onChange={(e) => onCode(e.target.value)}
        placeholder={t("hint")}
        className="mt-7 w-full max-w-[620px] border-b border-edge bg-transparent pb-4 font-mono text-lead text-ink outline-none transition-colors duration-state placeholder:text-ink-3 focus:border-thread"
      />
      {error ? <p className="measure pt-4 text-small text-iron">{error}</p> : null}
      <p className="measure pt-4 text-small text-ink-3">{t("note")}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-control text-small text-thread underline underline-offset-2"
      >
        {t("back")}
      </button>
    </div>
  );
}

// Step 4. Step-by-step connection guide for Claude Code, Antigravity, Gemini CLI, Codex, and others.
export function AgentStep({
  agent,
  token,
  failed,
  repoRef,
  joinedWorkspace,
  onAgent,
  onRegenerate,
}: {
  agent: Agent;
  token: string | null;
  failed: boolean;
  /** What the project was filed under, which is what the coder has to send back.
   *  Null for somebody who joined a team: they have no project of their own, and
   *  the address that matters is whichever of the team's projects they open. */
  repoRef: string | null;
  /** Set when this account arrived by invitation, so the step says which archive
   *  the token it just minted actually reaches. */
  joinedWorkspace: string | null;
  onAgent: (agent: Agent) => void;
  onRegenerate: () => void;
}) {
  const t = useTranslations("onboarding.agent");
  const host = serverUrl.replace(/\/$/, "");

  return (
    <div>
      <h1 className="text-title">{t("title")}</h1>

      <div className="pt-6">
        {failed || !token ? (
          <div>
            <p className="measure text-small text-iron">{t("tokenFailed")}</p>
            <div className="pt-5">
              <Button variant="secondary" onClick={onRegenerate}>
                {t("regenerate")}
              </Button>
            </div>
          </div>
        ) : (
          <AgentSetupGuide
            agent={agent}
            token={token}
            host={host}
            repoRef={repoRef}
            joinedWorkspace={joinedWorkspace}
            onAgentChange={onAgent}
            onMintNewToken={onRegenerate}
            showRepoNotice={true}
          />
        )}
      </div>
    </div>
  );
}
