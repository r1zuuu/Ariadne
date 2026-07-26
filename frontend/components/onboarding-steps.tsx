"use client";

import { useTranslations } from "next-intl";
import { CommandBlock } from "./command-block";
import { Button, Field, Label } from "./ui";
import { serverUrl } from "@/lib/api";

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
      <div className="divide-y divide-hairline border-y border-hairline">
        <Field
          id={key}
          label={t(`${key}.label`)}
          placeholder={t(`${key}.hint`)}
          value={answers[key]}
          onChange={(e) => onAnswer(key, e.target.value)}
          note={t("optionalAnswer")}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[132px_1fr] gap-x-6 border-y border-hairline py-5">
        <div className="pt-1">
          <Label htmlFor="profile">{t("resultLabel")}</Label>
        </div>
        <textarea
          id="profile"
          rows={7}
          // The server caps a profile at 4000 characters, so the field stops there
          // rather than letting someone write past a rejection.
          maxLength={4000}
          value={profile}
          onChange={(e) => onProfile(e.target.value)}
          className="w-full resize-y rounded-control border border-edge bg-plaster-raised px-4 py-3 text-body text-ink outline-none"
          style={{ maxWidth: "68ch" }}
        />
      </div>
      <p className="max-w-[68ch] pt-5 text-small text-ink-2">{t("note")}</p>
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

// Step 2. Only the name is required, and the fields say so themselves rather
// than leaving it to an asterisk nobody reads.
export function ProjectStep({
  card,
  error,
  onChange,
}: {
  card: Card;
  error: string | null;
  onChange: (patch: Partial<Card>) => void;
}) {
  const t = useTranslations("onboarding.project");

  return (
    <div className="divide-y divide-hairline border-y border-hairline">
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
        note={t("optional")}
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
        <div role="radiogroup" aria-labelledby="etap" className="flex flex-wrap gap-6 py-3">
          {ETAPY.map((etap) => (
            <label key={etap} className="flex cursor-pointer items-center gap-3 text-body">
              <input
                type="radio"
                name="etap"
                value={etap}
                checked={card.etap === etap}
                onChange={() => onChange({ etap })}
                className="accent-blue"
              />
              {t(`etap.${etap}`)}
            </label>
          ))}
        </div>
      </Field>
      <Field
        id="ograniczenia"
        label={t("label.limits")}
        placeholder={t("hint.limits")}
        value={card.ograniczenia}
        onChange={(e) => onChange({ ograniczenia: e.target.value })}
        note={t("optional")}
      />
    </div>
  );
}

// Step 3. Claude Code gets a command; the others get the same token with an
// honest sentence saying there is no ready-made command for them.
export function AgentStep({
  agent,
  token,
  failed,
  onAgent,
  onRegenerate,
}: {
  agent: Agent;
  token: string | null;
  failed: boolean;
  onAgent: (agent: Agent) => void;
  onRegenerate: () => void;
}) {
  const t = useTranslations("onboarding.agent");
  const host = serverUrl.replace(/\/$/, "");

  return (
    <div>
      <div className="border-y border-hairline">
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
                  className="accent-blue"
                />
                {t(`option.${option}`)}
              </label>
            ))}
          </div>
        </Field>
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
          />
        ) : (
          <div>
            <p className="max-w-[68ch] text-small text-ink-2">{t("other.note", { url: `${host}/mcp` })}</p>
            <CommandBlock command={token} what={t("tokenWhat")} where={t("tokenWhere")} />
          </div>
        )}
      </div>
    </div>
  );
}
