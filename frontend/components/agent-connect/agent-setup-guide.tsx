"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { useLocale } from "@/app/locale-provider";
import { CommandBlock } from "@/components/command-block";
import { Button } from "@/components/ui";
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
  const { locale } = useLocale();

  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent>(agent);
  const [mode, setMode] = useState<"prompt" | "manual">("prompt");

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
  const promptText = config.getPrompt(host, effectiveToken, locale);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const verificationCmd =
    activeAgent === "claude-code"
      ? "claude mcp list"
      : activeAgent === "codex"
        ? "codex mcp list"
        : "/mcp";

  const copyVerificationCmd = async () => {
    try {
      await navigator.clipboard.writeText(verificationCmd);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // ignore
    }
  };

  const stepTitles = [
    t("step1Title"),
    t("step2Title"),
    t("step3Title"),
  ];

  const getDepth = (cardIdx: number, active: number) => {
    if (cardIdx === active) return 0;
    if (active === 0) return cardIdx;
    if (active === 1) return cardIdx === 0 ? 1 : 2;
    return cardIdx === 1 ? 1 : 2;
  };

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
                onClick={() => {
                  setAgent(opt);
                  setCurrentStep(0);
                }}
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

      {/* Polished token guidance card */}
      {!token ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-card border border-edge/50 bg-surface/60 p-4 shadow-card backdrop-blur-sm">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-thread/10 text-thread border border-thread/20">
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="6" cy="6" r="3.5" />
                <path d="M8.5 8.5L13.5 13.5M10.5 10.5l1.5 1.5M12 12l1 1" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-small font-medium text-ink">
                Instrukcja z zapisanym tokenem
              </p>
              <p className="pt-0.5 text-data text-ink-3">
                W poniższym poleceniu znajduje się znacznik <code className="rounded bg-plaster-sunk px-1.5 py-0.5 font-mono text-[11px] text-thread">TWÓJ_TOKEN</code>. Wklej swój token lub wygeneruj nowy.
              </p>
            </div>
          </div>
          {onMintNewToken ? (
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
      ) : null}

      {/* Walkthrough Section (Stepper + 3D Stacked Cards) */}
      <div className="!mt-4 space-y-2.5">
        {/* 3 Rectangles Stepper Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 3 Rectangles Stepper */}
          <div className="flex items-center gap-2 w-full sm:max-w-[280px]">
            {[0, 1, 2].map((idx) => {
              const isActive = idx === currentStep;
              const isDone = idx < currentStep;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`h-2 flex-1 rounded-sm transition-all duration-300 ${
                    isActive
                      ? "bg-thread"
                      : isDone
                        ? "bg-thread/45 hover:bg-thread/65"
                        : "bg-edge/60 hover:bg-edge"
                  }`}
                  title={`Krok ${idx + 1}: ${stepTitles[idx]}`}
                  aria-label={`Krok ${idx + 1}`}
                />
              );
            })}
          </div>

          {/* Counter & Arrow Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="font-mono text-data text-ink-3">
              Krok {currentStep + 1} z 3
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-control border border-edge/60 bg-surface/50 text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-25 disabled:pointer-events-none transition-all"
                aria-label="Poprzedni krok"
                title="Poprzedni krok"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13L5 8l5-5" />
                </svg>
              </button>
              <button
                type="button"
                disabled={currentStep === 2}
                onClick={() => setCurrentStep((s) => Math.min(2, s + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-control border border-edge/60 bg-surface/50 text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-25 disabled:pointer-events-none transition-all"
                aria-label="Następny krok"
                title="Następny krok"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 3D Stacked Card Carousel Walkthrough with Fixed Unified Height */}
        <div className="relative pt-7 pb-1">
          <div className="relative h-[510px] sm:h-[475px] w-full">
            {[0, 1, 2].map((idx) => {
              const depth = getDepth(idx, currentStep);
              const isActive = depth === 0;

              return (
                <m.div
                  key={idx}
                  initial={false}
                  style={{ transformOrigin: "top center" }}
                  animate={{
                    y: depth === 0 ? 0 : depth === 1 ? -12 : -24,
                    scale: depth === 0 ? 1 : depth === 1 ? 0.98 : 0.96,
                    opacity: depth === 0 ? 1 : depth === 1 ? 0.75 : 0.45,
                    zIndex: depth === 0 ? 30 : depth === 1 ? 20 : 10,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                  onClick={() => {
                    if (!isActive) setCurrentStep(idx);
                  }}
                  className={`absolute inset-0 rounded-card border transition-colors ${
                    isActive
                      ? "z-30 border-edge/70 bg-surface/95 p-5 sm:p-6 shadow-card backdrop-blur-md"
                      : "border-edge/40 bg-surface/85 p-2 sm:p-2.5 shadow-card cursor-pointer select-none overflow-hidden hover:border-edge-strong"
                  }`}
                >
                  {!isActive ? (
                    // Inactive Background Card Shell (Peeking Top Header)
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-3">
                          {idx + 1}
                        </span>
                        <span className="text-[12px] font-medium text-ink-3 truncate max-w-[200px] sm:max-w-none">
                          {stepTitles[idx]}
                        </span>
                      </div>
                      <span className="font-mono text-[10.5px] text-ink-3/70">
                        Krok {idx + 1}
                      </span>
                      {/* Subtle darkening shade */}
                      <div className="absolute inset-0 -m-3 bg-plaster/50 rounded-card pointer-events-none" />
                    </div>
                  ) : (
                    // Active Card Full Content with Horizontal Glide Transition
                    <AnimatePresence mode="wait" initial={false}>
                      <m.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col justify-between h-full"
                      >
                        <div className="flex-1 overflow-y-auto pr-1">
                          {currentStep === 0 ? (
                            // Step 1: Open Tool
                            <div className="space-y-4">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-thread text-plaster text-data font-bold">
                                  1
                                </span>
                                <h3 className="text-body font-semibold text-ink">{t("step1Title")}</h3>
                              </div>
                              <p className="measure text-small text-ink-2 leading-relaxed">
                                {t(`steps.${activeAgent}.step1`)}
                              </p>
                              <div className="rounded-control border border-edge/50 bg-plaster-sunk/70 p-4 flex items-start gap-3 mt-1">
                                <div className="mt-0.5 text-thread">
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                                    <circle cx="8" cy="8" r="7" />
                                    <path d="M8 5v3M8 11h.01" />
                                  </svg>
                                </div>
                                <div className="text-small text-ink-2 leading-relaxed">
                                  {activeAgent === "claude-code"
                                    ? "Otwórz okno terminala w katalogu swojego projektu, aby Claude Code miał natychmiastowy dostęp do kodu i repozytorium."
                                    : activeAgent === "antigravity"
                                      ? "Uruchom Google Antigravity IDE i upewnij się, że projekt jest załadowany w przestrzeni roboczej."
                                      : activeAgent === "gemini-cli"
                                        ? "Uruchom Gemini CLI w terminalu po uzupełnieniu konfiguracji w pliku settings.json."
                                        : "Upewnij się, że narzędzie CLI jest zainstalowane i dostępne w Twoim środowisku."}
                                </div>
                              </div>
                            </div>
                          ) : currentStep === 1 ? (
                            // Step 2: Configure Agent
                            <div className="space-y-3.5">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-thread text-plaster text-data font-bold">
                                    2
                                  </span>
                                  <h3 className="text-body font-semibold text-ink">{t("step2Title")}</h3>
                                </div>

                                {/* Mode Switcher: Prompt vs Manual (NO EMOJI) */}
                                <div className="flex items-center rounded-control border border-edge/60 bg-plaster-sunk/80 p-0.5 text-data">
                                  <button
                                    type="button"
                                    onClick={() => setMode("prompt")}
                                    className={`rounded-[5px] px-3 py-1 font-medium transition-all ${
                                      mode === "prompt"
                                        ? "bg-thread text-plaster shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                                        : "text-ink-2 hover:text-ink"
                                    }`}
                                  >
                                    {t("modePrompt")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMode("manual")}
                                    className={`rounded-[5px] px-3 py-1 font-medium transition-all ${
                                      mode === "manual"
                                        ? "bg-thread text-plaster shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                                        : "text-ink-2 hover:text-ink"
                                    }`}
                                  >
                                    {t("modeManual")}
                                  </button>
                                </div>
                              </div>

                              <div>
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
                            </div>
                          ) : (
                            // Step 3: Verify Connection
                            <div className="space-y-4">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-thread text-plaster text-data font-bold">
                                  3
                                </span>
                                <h3 className="text-body font-semibold text-ink">{t("step3Title")}</h3>
                              </div>
                              <p className="measure text-small text-ink-2 leading-relaxed">
                                {t(`steps.${activeAgent}.step3`, { cmd: verificationCmd })}
                              </p>
                              <div className="rounded-control border border-edge/60 bg-canvas p-3.5 flex items-center justify-between gap-3">
                                <code className="font-mono text-data text-canvas-ink selection:bg-thread/30">
                                  {verificationCmd}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => void copyVerificationCmd()}
                                  className="inline-flex items-center gap-1.5 rounded-control border border-edge/60 bg-surface px-2.5 py-1 text-data text-ink-2 hover:text-ink transition-colors"
                                >
                                  {copiedCmd ? "Skopiowano" : "Kopiuj"}
                                </button>
                              </div>
                              <div className="rounded-control border border-laurel/30 bg-laurel/10 p-3.5 flex items-center gap-3">
                                <div className="text-laurel">
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                                <p className="text-small text-laurel font-medium">
                                  Po pomyślnym sprawdzeniu narzędzia pamięci Ariadne będą aktywne w każdej sesji.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Step Card Bottom Navigation */}
                        <div className="shrink-0 flex items-center justify-between pt-3.5 border-t border-hairline/60 mt-3">
                          {currentStep > 0 ? (
                            <Button
                              variant="quiet"
                              onClick={() => setCurrentStep((s) => s - 1)}
                              className="gap-2"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10 13L5 8l5-5" />
                              </svg>
                              <span>Wstecz</span>
                            </Button>
                          ) : (
                            <div />
                          )}

                          {currentStep < 2 ? (
                            <Button
                              onClick={() => setCurrentStep((s) => s + 1)}
                              className="gap-2"
                            >
                              <span>{currentStep === 0 ? "Dalej: Konfiguracja" : "Dalej: Weryfikacja"}</span>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 3l5 5-5 5" />
                              </svg>
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 text-data text-laurel font-medium">
                              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <span>Gotowe</span>
                            </div>
                          )}
                        </div>
                      </m.div>
                    </AnimatePresence>
                  )}
                </m.div>
              );
            })}
          </div>
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
