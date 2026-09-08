"use client";

import { useTranslations } from "next-intl";
import { serverUrl } from "@/lib/api";
import { Field } from "./ui";

// What a coder needs in order to reach this backend, in one place.
//
// Two screens hand it out: the first-run wizard, and settings when somebody
// mints a token for a second machine. The command they print has to be the same
// command. It used to exist only in the wizard, which is guarded against a
// second run, so the second machine - the case settings exists for - got a bare
// token and no instructions at all.
//
// The sentences around the command are deliberately not here. Onboarding is
// walking somebody through a wizard they cannot leave; settings is finishing a
// job they came to do. The same paragraph cannot be both, and pretending it can
// is how the wizard's "skip this step" ended up on a screen with no steps.

const AGENTS = ["claude-code", "codex", "other"] as const;
export type Agent = (typeof AGENTS)[number];

/** Trailing slash stripped: this is built from an env var somebody typed. */
export const mcpUrl = `${serverUrl.replace(/\/$/, "")}/mcp`;

/** The whole line, token included. Never rendered without a real token: a
 *  placeholder in a copyable command is a command that fails on paste. */
export function connectCommand(token: string) {
  return `claude mcp add --scope user --transport http ariadne ${mcpUrl} --header "Authorization: Bearer ${token}"`;
}

export function AgentChoice({
  agent,
  name,
  onAgent,
}: {
  agent: Agent;
  /** The radio group's form name, distinct per screen. */
  name: string;
  onAgent: (agent: Agent) => void;
}) {
  const t = useTranslations("onboarding.agent");

  return (
    <Field id={name} label={t("label")}>
      {/* aria-label rather than aria-labelledby: Field renders its Label with an
          htmlFor and no id of its own, so pointing at the field's id named an
          element that was never there and left the group unlabelled. */}
      <div
        role="radiogroup"
        aria-label={t("label")}
        className="flex flex-wrap gap-6 py-3"
      >
        {AGENTS.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-3 text-body">
            <input
              type="radio"
              name={name}
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
  );
}
