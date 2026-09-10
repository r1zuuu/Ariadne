"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/locale-provider";
import { AgentSetupGuide, type SupportedAgent } from "@/components/agent-connect";
import { CommandBlock } from "@/components/command-block";
import { useFailure } from "@/components/failure";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  Input,
  Meta,
  PageHeader,
  SectionHeader,
} from "@/components/ui";
import { deleteToken, listTokens, mintToken, serverUrl, type ApiToken } from "@/lib/api";

const LABEL_FIELD = "agents-token-label";

export default function AgentsScreen() {
  const t = useTranslations("agentsPage");
  const toast = useToast();
  const failure = useFailure();
  const { locale } = useLocale();

  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent>("claude-code");

  const host = serverUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));

  const load = useCallback(() => {
    void listTokens()
      .then(setTokens)
      .catch(() => setTokens([]));
  }, []);

  useEffect(load, [load]);

  const mint = async () => {
    setWorking("mint");
    try {
      const minted = await mintToken(label.trim());
      setFresh(minted.token);
      setLabel("");
      load();
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setWorking(null);
    }
  };

  const revoke = async (id: string) => {
    setWorking(id);
    try {
      await deleteToken(id);
      setConfirming(null);
      toast(t("tokenRevoked"));
      load();
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setWorking(null);
    }
  };

  // The guide's "create a new token" and the panel's own form are the same
  // action. Rather than a second form inside the guide, the button sends the
  // reader to the one field that mints, wherever the layout has put it.
  const focusNewToken = () => {
    const field = document.getElementById(LABEL_FIELD);
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    field?.focus({ preventScroll: true });
  };

  return (
    <div className="work-canvas">
      <PageHeader size="work" title={t("title")} lead={t("lead")} />

      {/* The point of the screen is connecting a tool, so that is the column
          that gets the room and the top of the page. Tokens are what the
          connection needs, not what the reader came to do: they sit beside it on
          a wide screen and under it on a narrow one - either way, the tool
          picker and the first step are on screen without scrolling past a list
          of tokens to reach them. */}
      <div className="grid gap-8 min-[1400px]:grid-cols-[minmax(0,1fr)_360px] min-[1400px]:items-start min-[1400px]:gap-10">
        <section>
          <AgentSetupGuide
            agent={selectedAgent}
            token={fresh}
            host={host}
            onAgentChange={setSelectedAgent}
            onMintNewToken={focusNewToken}
            showRepoNotice={false}
          />
        </section>

        <aside className="min-w-0">
          <SectionHeader
            title={t("tokensTitle")}
            count={tokens?.length}
            note={t("tokensLead")}
          />

          {fresh ? (
            <div className="pb-6">
              <CommandBlock
                command={fresh}
                what={t("tokenOnce")}
                where={t("tokenOnceWhere")}
                copyLabel={t("copyToken")}
              />
            </div>
          ) : null}

          <Card className="p-5">
            <Input
              id={LABEL_FIELD}
              label={t("tokenLabel")}
              placeholder={t("tokenPlaceholder")}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void mint();
                }
              }}
            />
            <div className="pt-4">
              <Button onClick={() => void mint()} loading={working === "mint"}>
                {working === "mint" ? t("minting") : t("mint")}
              </Button>
            </div>
          </Card>

          <div className="pt-5">
            {tokens === null ? (
              <p className="text-small text-ink-3">{t("loading")}</p>
            ) : tokens.length === 0 ? (
              <p className="measure-tight text-small text-ink-3">{t("tokensEmptyNote")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {tokens.map((item) => (
                  <li key={item.id} className="py-4 first:pt-0">
                    {confirming === item.id ? (
                      // In place, not in a modal, and it says what revoking
                      // costs before it asks. The old row put an unlabelled
                      // "Odwołaj" one click away from cutting an agent off.
                      <div>
                        <p className="text-small font-medium text-ink">
                          {t("revokeAsk", { label: item.label || t("noLabel") })}
                        </p>
                        <p className="pt-1 text-data text-ink-2">{t("revokeAskNote")}</p>
                        <div className="flex flex-wrap gap-2 pt-4">
                          <Button
                            size="sm"
                            variant="destructive"
                            loading={working === item.id}
                            onClick={() => void revoke(item.id)}
                          >
                            {t("revokeConfirm")}
                          </Button>
                          <Button
                            size="sm"
                            variant="quiet"
                            onClick={() => setConfirming(null)}
                          >
                            {t("cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-small font-medium text-ink">
                            {item.label || t("noLabel")}
                          </p>
                          <div className="pt-1">
                            {/* What the server actually knows about this token.
                                The row used to say "używany", which reads as an
                                agent being connected right now; a token has no
                                such state, only a last time somebody presented
                                it. */}
                            <Meta
                              items={[
                                t("createdOn", { date: stamp(item.createdAt) }),
                                item.lastUsedAt
                                  ? t("lastUsed", { date: stamp(item.lastUsedAt) })
                                  : t("neverUsed"),
                              ]}
                            />
                          </div>
                          {item.lastUnknownRepo ? (
                            <p className="pt-2 text-data text-ochre">
                              {t("unknownRepo", { repo: item.lastUnknownRepo })}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => setConfirming(item.id)}
                        >
                          {t("revoke")}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
