"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { useLocale } from "@/app/locale-provider";
import { CommandBlock } from "@/components/command-block";
import { enterTransition } from "@/components/motion";
import { Button } from "@/components/ui";
import { AGENT_CONFIGS } from "./agent-configs";
import { SUPPORTED_AGENTS, type SupportedAgent } from "./types";

const STEPS = [0, 1, 2] as const;
const LAST = STEPS.length - 1;

/** What each step looks like from behind: how far up, how much smaller, how dim. */
const DEPTHS = [
  { y: 0, scale: 1, opacity: 1, z: 30 },
  { y: -10, scale: 0.985, opacity: 0.6, z: 20 },
  { y: -20, scale: 0.97, opacity: 0.35, z: 10 },
] as const;

/** Which layer a card sits on, given which one is in front. */
function depthOf(card: number, active: number): number {
  if (card === active) return 0;
  if (active === 0) return card;
  if (active === 1) return card === 0 ? 1 : 2;
  return card === 1 ? 1 : 2;
}

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
  const { locale } = useLocale();

  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent>(agent);
  const [mode, setMode] = useState<"prompt" | "manual">("prompt");
  const [step, setStep] = useState(0);

  const activeAgent = onAgentChange ? agent : selectedAgent;
  const setAgent = (next: SupportedAgent) => {
    if (onAgentChange) onAgentChange(next);
    else setSelectedAgent(next);
    setStep(0);
  };

  // The word that stands in the command until a real token replaces it. It gets
  // copied into a terminal, so it is written in the reader's language and passed
  // into the sentence that explains it rather than repeated in the messages,
  // where the two would drift apart.
  const placeholder = locale === "en" ? "YOUR_TOKEN" : "TWÓJ_TOKEN";

  const config = AGENT_CONFIGS[activeAgent];
  const effectiveToken = token?.trim() || placeholder;
  const snippet = config.getSnippet(host, effectiveToken);
  const promptText = config.getPrompt(host, effectiveToken, locale);

  // Only where a command actually verifies the connection. "Other" is any MCP
  // client, and there is no command this app can promise it understands, so it
  // gets the sentence and no code block pretending to be one.
  const verifyCommand =
    activeAgent === "claude-code"
      ? "claude mcp list"
      : activeAgent === "codex"
        ? "codex mcp list"
        : activeAgent === "other"
          ? null
          : "/mcp";

  const stepTitles = [t("step1Title"), t("step2Title"), t("step3Title")];

  // The three cards are absolutely positioned, so the stack has no height of its
  // own and takes the front card's. Watched, not measured once: a single
  // measurement goes stale the moment the content under it changes - a longer
  // command, a switched tool, the token arriving - and then the section below
  // climbs into the card. Nothing here clips, so a frame where the number lags
  // only moves what follows.
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const [stackHeight, setStackHeight] = useState(0);

  useLayoutEffect(() => {
    const node = cards.current[step];
    if (!node) return;
    const sync = () => setStackHeight(node.offsetHeight);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [step, activeAgent, mode, token]);

  const clamp = (value: number) => Math.min(LAST, Math.max(0, value));
  /** Jump straight to a step: the progress marks. */
  const go = (next: number) => setStep(clamp(next));
  /** Move by one. Functional, so two clicks inside one render still land two
   *  steps on rather than twice on the same one. */
  const stepBy = (delta: number) => setStep((current) => clamp(current + delta));

  return (
    <div className="space-y-6">
      {/* Which tool, first: everything below it is written for the one picked. */}
      <div>
        <p className="pb-3 text-small font-medium text-ink">{t("label")}</p>
        <div role="radiogroup" aria-label={t("label")} className="flex flex-wrap gap-2">
          {SUPPORTED_AGENTS.map((option) => {
            const selected = activeAgent === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAgent(option)}
                className={`rounded-control border px-4 py-2 text-small font-medium transition-colors duration-state ${
                  selected
                    ? "border-thread bg-thread-soft text-thread-lift"
                    : "border-edge/50 bg-surface/70 text-ink-2 hover:border-edge hover:bg-surface hover:text-ink"
                }`}
              >
                {t(`options.${option}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Which archive the token being minted actually reaches, and where the
          coder has to stand. Only the wizard shows this; on the agents screen
          the reader already has a project open. */}
      {showRepoNotice ? (
        <div className="border-y border-hairline py-5">
          <p className="measure text-small text-ink-2">{t("tips.onceOnly")}</p>
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
              <p className="pt-2 font-data text-data text-ink-2">{repoRef}</p>
              <p className="measure pt-2 text-small text-ink-2">{tOnboarding("mustMatch")}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {/* What the command below is carrying. The old version of this said
          "Instrukcja z zapisanym tokenem" over a paragraph explaining that the
          token is not there and has to be pasted in - a heading that contradicted
          its own body. Two states, and each says which one it is. */}
      <div className="flex flex-col gap-4 rounded-card border border-edge/50 bg-plaster-sunk px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-small font-medium text-ink">
            {token ? t("tokenReadyTitle") : t("tokenNeededTitle")}
          </p>
          <p className="measure-wide pt-1 text-data text-ink-2">
            {token ? t("tokenReadyBody") : t("tokenNeededBody", { placeholder })}
          </p>
        </div>
        {!token && onMintNewToken ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onMintNewToken}
            className="shrink-0 self-start sm:self-center"
          >
            {t("mintNew")}
          </Button>
        ) : null}
      </div>

      {/* Three cards, one in front. The two behind are decoration with a job:
          they say how many steps there are and that this one is not the last.
          They carry no content, take no clicks and no focus - only their top
          edge is ever on screen. */}
      <div className="pt-5">
        <div
          className="relative"
          style={{
            height: stackHeight || undefined,
            // A CSS transition rather than an animated value: going from `auto`
            // to a number does not animate, so the first measurement lands
            // instantly and every step change after it glides. The global
            // reduced-motion rule zeroes this along with everything else.
            transition: "height var(--duration-enter) var(--ease-out-quint)",
          }}
        >
          {STEPS.map((index) => {
            const depth = DEPTHS[depthOf(index, step)];
            const active = index === step;
            return (
              <m.div
                key={index}
                ref={(node: HTMLDivElement | null) => {
                  cards.current[index] = node;
                }}
                inert={!active}
                aria-hidden={!active || undefined}
                initial={false}
                animate={{ y: depth.y, scale: depth.scale, opacity: depth.opacity }}
                transition={enterTransition}
                style={{ transformOrigin: "top center", zIndex: depth.z }}
                className={`absolute inset-x-0 top-0 rounded-card border ${
                  active
                    ? "border-edge/70 bg-surface p-5 shadow-card sm:p-6"
                    : "bottom-0 border-edge/40 bg-surface-2 pointer-events-none"
                }`}
              >
                {active ? (
                  <>
                    <h3 className="text-body font-semibold text-ink">
                      {stepTitles[index]}
                    </h3>

                    <div className="pt-4">
                      {index === 0 ? (
                        <>
                          <p className="measure text-small text-ink-2">
                            {t(`steps.${activeAgent}.step1`)}
                          </p>
                          {/* An aside, not another card. A hint that needs a box
                              around it is a hint nobody believes. */}
                          <p className="measure pt-3 text-small text-ink-3">
                            {t(`hints.${activeAgent}`)}
                          </p>
                        </>
                      ) : index === 1 ? (
                        <>
                          <div className="flex w-fit rounded-control border border-edge/60 bg-plaster-sunk p-1 text-data">
                            {(["prompt", "manual"] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                aria-pressed={mode === option}
                                onClick={() => setMode(option)}
                                className={`rounded-[4px] px-3 py-1 font-medium transition-colors duration-state ${
                                  mode === option
                                    ? "bg-surface text-ink"
                                    : "text-ink-2 hover:text-ink"
                                }`}
                              >
                                {t(option === "prompt" ? "modePrompt" : "modeManual")}
                              </button>
                            ))}
                          </div>
                          <div className="pt-5">
                            {mode === "prompt" ? (
                              <CommandBlock
                                command={promptText}
                                what={t("step2PromptWhat")}
                                where={t("step2PromptWhere")}
                                copyLabel={t("copyPrompt")}
                                warn={token ? tOnboarding("tokenOnce") : undefined}
                              />
                            ) : (
                              <CommandBlock
                                command={snippet}
                                what={t(`steps.${activeAgent}.step2What`)}
                                where={t(`steps.${activeAgent}.step2Where`)}
                                warn={token ? tOnboarding("tokenOnce") : undefined}
                              />
                            )}
                          </div>
                        </>
                      ) : verifyCommand ? (
                        <CommandBlock
                          command={verifyCommand}
                          what={t(`steps.${activeAgent}.step3`, { cmd: verifyCommand })}
                          where={t("verifyWhere")}
                        />
                      ) : (
                        <p className="measure text-small text-ink-2">
                          {t(`steps.${activeAgent}.step3`, { cmd: "" })}
                        </p>
                      )}
                    </div>

                    {/* One place to move from, at the bottom of the card the
                        reader has just finished. The counter, the arrow pair
                        floating above the stack and the number in a circle are
                        all gone: the heading already says which step this is. */}
                    <div className="mt-6 flex items-center justify-between gap-4 border-t border-hairline pt-4">
                      <div
                        role="group"
                        aria-label={t("progressLabel")}
                        className="flex items-center gap-2"
                        onKeyDown={(event) => {
                          if (event.key === "ArrowRight") stepBy(1);
                          if (event.key === "ArrowLeft") stepBy(-1);
                        }}
                      >
                        {STEPS.map((mark) => (
                          <button
                            key={mark}
                            type="button"
                            onClick={() => go(mark)}
                            aria-label={stepTitles[mark]}
                            aria-current={mark === step ? "step" : undefined}
                            className={`h-[6px] w-[34px] rounded-[2px] transition-colors duration-state ${
                              mark === step
                                ? "bg-thread"
                                : mark < step
                                  ? "bg-thread/40 hover:bg-thread/60"
                                  : "bg-edge hover:bg-edge-strong"
                            }`}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        {step > 0 ? (
                          <Button variant="quiet" size="sm" onClick={() => stepBy(-1)}>
                            {t("back")}
                          </Button>
                        ) : null}
                        {step < LAST ? (
                          <Button size="sm" onClick={() => stepBy(1)}>
                            {t("next", { step: t(`stepShort.${step + 2}`) })}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </m.div>
            );
          })}
        </div>
      </div>

      <details className="group rounded-control border border-edge/50 bg-plaster-sunk px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-small font-medium text-ink marker:hidden">
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
        <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-small text-ink-2">
          <p className="measure-wide">{t("tips.alreadyExists")}</p>
          <p className="measure-wide">{t("tips.repoRef")}</p>
        </div>
      </details>
    </div>
  );
}
