"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AgentSetupGuide, type SupportedAgent } from "@/components/agent-connect";
import { CommandBlock } from "@/components/command-block";
import { useFailure } from "@/components/failure";
import { IconToken } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Meta,
  PageHeader,
  SectionHeader,
} from "@/components/ui";
import {
  deleteToken,
  listTokens,
  mintToken,
  serverUrl,
  type ApiToken,
} from "@/lib/api";

export default function AgentsScreen() {
  const t = useTranslations("agentsPage");
  const toast = useToast();
  const failure = useFailure();

  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent>("claude-code");

  const host = serverUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const load = useCallback(() => {
    void listTokens().then(setTokens).catch(() => setTokens([]));
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
      toast(t("tokenRevoked"));
      load();
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setWorking(null);
    }
  };

  const focusNewToken = () => {
    document.getElementById("agents-token-label")?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-[860px] pb-16">
      <PageHeader title={t("title")} lead={t("lead")} />

      {/* Section 1: Token Management */}
      <section className="pt-6">
        <SectionHeader
          title={t("tokensTitle")}
          count={tokens?.length}
          icon={<IconToken />}
          note={t("tokensLead")}
        />

        {/* Freshly minted token block */}
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

        {/* Form to mint new token */}
        <Card className="flex flex-wrap items-end gap-5 p-6">
          <div className="min-w-[200px] flex-1">
            <Input
              id="agents-token-label"
              label={t("tokenLabel")}
              placeholder={t("tokenPlaceholder")}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void mint();
                }
              }}
            />
          </div>
          <Button onClick={mint} loading={working === "mint"}>
            {working === "mint" ? t("minting") : t("mint")}
          </Button>
        </Card>

        {/* Active tokens list */}
        <div className="pt-5">
          {tokens === null ? (
            <p className="text-body text-ink-3">{t("loading") ?? "..."}</p>
          ) : tokens.length === 0 ? (
            <EmptyState title={t("tokensEmpty")} note={t("tokensEmptyNote")} />
          ) : (
            <ul className="divide-y divide-hairline">
              {tokens.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body text-ink font-medium">
                      {item.label || t("noLabel")}
                    </p>
                    <div className="pt-1">
                      <Meta items={[item.lastUsedAt ? t("used") : t("neverUsed")]} />
                    </div>
                  </div>
                  <Button
                    variant="quiet"
                    onClick={() => revoke(item.id)}
                    loading={working === item.id}
                  >
                    {t("revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Section 2: Interactive Connection Guide */}
      <section className="mt-12 border-t border-hairline pt-8">
        <h2 className="text-title pb-6">{t("guideHeader")}</h2>

        <AgentSetupGuide
          agent={selectedAgent}
          token={fresh}
          host={host}
          onAgentChange={setSelectedAgent}
          onMintNewToken={focusNewToken}
          showRepoNotice={false}
        />
      </section>
    </div>
  );
}
