"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CommandBlock } from "@/components/command-block";
import { Button, Field } from "@/components/ui";
import { AGENT_CONFIGS } from "./agent-configs";
import { SUPPORTED_AGENTS, type SupportedAgent } from "./types";

export function AgentSetupGuide({
  agent,
  token,
  host,
  repoRef,
  joinedWorkspace,
  onAgentChange,
  onMintNewToken,
  showRepoNotice = true,
}: {
  agent: SupportedAgent;
  token: string | null;
  host: string;
  repoRef?: string | null;
  joinedWorkspace?: string | null;
  onAgentChange?: (agent: SupportedAgent) => void;
  onMintNewToken?: () => void;
  showRepoNotice?: boolean;
}) {
  const t = useTranslations("agentConnect");
  const tOnboarding = useTranslations("onboarding.agent");

  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent>(agent);

  const activeAgent = onAgentChange ? agent : selectedAgent;
  const setAgent = (next: SupportedAgent) => {
    if (onAgentChange) {
      onAgentChange(next);
    } else {
      setSelectedAgent(next);
    }
  };

  const config = AGENT_CONFIGS[activeAgent];
  const effectiveToken = token?.trim() || "TWÓJ_TOKEN";
  const snippet = config.getSnippet(host, effectiveToken);

  return (
    <div className="space-y-7">
      {/* Agent Selector */}
      <div className="border-y border-hairline py-4">
        <p className="pb-2.5 text-small font-medium text-ink">{t("label")}</p>
        <div
          role="radiogroup"
          aria-label={t("label")}
          className="flex flex-wrap gap-2"
        >
          {SUPPORTED_AGENTS.map((opt) => {
            const isSelected = activeAgent === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setAgent(opt)}
                className={`rounded-control border px-3.5 py-2 text-small font-medium transition-all duration-state ${
                  isSelected
                    ? "border-thread/80 bg-thread-soft text-thread-lift shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                    : "border-edge/50 bg-surface/70 text-ink-2 hover:border-edge hover:bg-surface hover:text-ink"
                }`}
              >
                {t(`options.${opt}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scope / Repo match notice */}
      {showRepoNotice ? (
        <div className="rounded-control border border-edge/50 bg-plaster-sunk/80 p-5">
          <p className="measure text-small text-ink">{t("tips.onceOnly")}</p>
          {joinedWorkspace ? (
            <>
              <p className="measure pt-3 text-small text-ink">
                {tOnboarding("joinedArchive", { name: joinedWorkspace })}
              </p>
              <p className="measure pt-2 text-small text-ink-2">
                {tOnboarding("joinedWhereToRun")}
              </p>
            </>
          ) : repoRef ? (
            <>
              <p className="measure pt-3 text-small text-ink">{tOnboarding("whereToRun")}</p>
              <p className="pt-2 font-mono text-data text-ink-2">{repoRef}</p>
              <p className="measure pt-2 text-small text-ink-2">{tOnboarding("mustMatch")}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Notice if token is masked / placeholder */}
      {!token ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-control border border-ochre/30 bg-ochre/10 p-4">
          <p className="measure text-small text-ochre">
            {t("tokenNoticeExisting", { placeholder: "TWÓJ_TOKEN" })}
          </p>
          {onMintNewToken ? (
            <Button variant="secondary" size="md" onClick={onMintNewToken}>
              {t("mintNew")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Step by Step Guide with numbered badges */}
      <div className="space-y-5">
        {/* Step 1 */}
        <div className="rounded-card border border-edge/40 bg-surface/70 p-5 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-thread/15 text-data font-semibold text-thread">
              1
            </span>
            <h3 className="text-small font-semibold text-ink">{t("step1Title")}</h3>
          </div>
          <p className="measure pt-2.5 text-small text-ink-2 leading-relaxed">
            {t(`steps.${activeAgent}.step1`)}
          </p>
        </div>

        {/* Step 2 */}
        <div className="rounded-card border border-edge/40 bg-surface/70 p-5 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-thread/15 text-data font-semibold text-thread">
              2
            </span>
            <h3 className="text-small font-semibold text-ink">{t("step2Title")}</h3>
          </div>
          <div className="pt-3">
            <CommandBlock
              command={snippet}
              what={t(`steps.${activeAgent}.step2What`)}
              where={t(`steps.${activeAgent}.step2Where`)}
              warn={token ? tOnboarding("tokenOnce") : undefined}
            />
          </div>
        </div>

        {/* Step 3 */}
        <div className="rounded-card border border-edge/40 bg-surface/70 p-5 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-thread/15 text-data font-semibold text-thread">
              3
            </span>
            <h3 className="text-small font-semibold text-ink">{t("step3Title")}</h3>
          </div>
          <p className="measure pt-2.5 text-small text-ink-2 leading-relaxed">
            {t(`steps.${activeAgent}.step3`, {
              cmd:
                activeAgent === "claude-code"
                  ? "claude mcp list"
                  : activeAgent === "codex"
                    ? "codex mcp list"
                    : "/mcp",
            })}
          </p>
        </div>
      </div>

      {/* Troubleshooting Section */}
      <details className="group rounded-control border border-edge/60 bg-plaster-sunk p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-small font-medium text-ink">
          <span>{t("troubleshootingTitle")}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="text-ink-3 transition-transform duration-state group-open:rotate-180"
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </summary>
        <div className="mt-3 space-y-2 border-t border-hairline pt-3 text-small text-ink-2">
          <p>• {t("tips.alreadyExists")}</p>
          <p>• {t("tips.repoRef")}</p>
        </div>
      </details>
    </div>
  );
}
