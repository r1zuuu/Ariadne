"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { LOCALES, useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { useFailure } from "@/components/failure";
import { CommandBlock } from "@/components/command-block";
import {
  IconAccount,
  IconAutoApprove,
  IconKey,
  IconSkills,
  IconToken,
} from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Meta,
  PageHeader,
  SectionHeader,
  Textarea,
} from "@/components/ui";
import {
  ApiError,
  changePassword,
  clearGeminiKey,
  deleteToken,
  GEMINI_KEY_CONSOLE,
  getAccount,
  listTokens,
  mintToken,
  saveGeminiKey,
  saveProfile,
  setAllPermission,
  type Account,
  type ApiToken,
} from "@/lib/api";
import { openExternal } from "@/lib/desktop";
import {
  inApp,
  linkAllSkills,
  scanSkills,
  summarise,
  type SkillsState,
} from "@/lib/skills";

// Screen 08. Everything about the account rather than about a project: who you
// are, what your coders may do, which tokens exist, and who else reads the same
// archive.
//
// One screen and not two. The team is not a place you work, it is a setting you
// change twice and forget, and a second entry in the column would suggest
// otherwise.

export default function SettingsScreen() {
  const t = useTranslations("settings");
  const toast = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState(false);

  const loadAccount = useCallback(() => {
    setAccountError(false);
    // A failed fetch used to park this screen on "loading" forever; the error
    // state with a retry is the difference between stuck and delayed.
    void getAccount()
      .then(setAccount)
      .catch((caught) => {
        // A rejected request is not an absent server. On 401 the client has
        // already dropped the token, so there is nothing on this screen to
        // retry: the session is over and the entrance is the only place to go.
        // Telling someone to check that a server is running, when that server
        // just answered, sends them looking in the wrong place entirely.
        if (caught instanceof ApiError && caught.status === 401) {
          window.location.href = "/";
          return;
        }
        setAccountError(true);
      });
  }, []);

  useEffect(loadAccount, [loadAccount]);

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title={t("title")} lead={t("lead")} />

      {account === null ? (
        accountError ? (
          <EmptyState
            title={t("accountError")}
            note={t("accountErrorNote")}
            action={
              <Button variant="secondary" onClick={loadAccount}>
                {t("retry")}
              </Button>
            }
          />
        ) : (
          <p className="text-body text-ink-3">{t("loading")}</p>
        )
      ) : (
        <>
          <AccountSection account={account} onSaved={setAccount} toast={toast} />
          <GeminiSection account={account} onSaved={setAccount} toast={toast} />
          <PermissionSection account={account} onSaved={setAccount} toast={toast} />
          <TokensSection toast={toast} />
          {/* Last, and outside the account entirely: everything above belongs to
              whoever is signed in, this one belongs to the computer. */}
          <SkillsSection toast={toast} />
        </>
      )}
    </div>
  );
}

type Toast = ReturnType<typeof useToast>;

// --- Account: who you are, and how you get in ---

function AccountSection({
  account,
  onSaved,
  toast,
}: {
  account: Account;
  onSaved: (account: Account) => void;
  toast: Toast;
}) {
  const t = useTranslations("settings");
  const failure = useFailure();
  const { locale, setLocale } = useLocale();

  const [profile, setProfile] = useState(account.profile);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveProfile(profile);
      onSaved({ ...account, profile: saved.profile });
      toast(t("saved"));
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pt-8">
      <SectionHeader title={t("account")} icon={<IconAccount />} />

      {/* Read-only facts get a hairline, not a card: there is nothing here to
          decide about. */}
      <div className="border-b border-hairline pb-5">
        <p className="text-body text-ink">{account.email}</p>
        <div className="pt-2">
          <Meta items={[t("memberSince", { at: new Date(account.createdAt).getFullYear() })]} />
        </div>
      </div>

      <Card className="mt-5 p-6">
        {/* Three rows tall, not five: the profile is a paragraph, and the
            empty rows below one line of text read as a hole in the card.
            The note and the button share a row for the same reason. */}
        <Textarea
          id="settings-profile"
          label={t("profile")}
          rows={3}
          value={profile}
          onChange={(event) => setProfile(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <p className="text-small text-ink-3">{t("profileNote")}</p>
          <Button onClick={save} loading={saving} disabled={profile === account.profile}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </Card>

      <PasswordCard toast={toast} hasPassword={account.hasPassword} />

      <div className="flex flex-wrap items-center gap-4 pt-6">
        <p className="text-small font-medium text-ink">{t("language")}</p>
        {/* The active language is a selected state, not a call to action:
            a full brand fill here outshouted every real CTA on the page. */}
        {LOCALES.map((code) => {
          const selected = code === locale;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={selected}
              onClick={() => setLocale(code)}
              className={`h-[36px] rounded-control border px-5 text-small font-medium transition-colors duration-state ${
                selected
                  ? "border-thread/40 bg-thread-soft text-thread-lift"
                  : "border-edge/60 bg-surface text-ink-2 hover:bg-plaster-sunk hover:text-ink"
              }`}
            >
              {t(`languages.${code}`)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PasswordCard({ toast, hasPassword }: { toast: Toast; hasPassword: boolean }) {
  const t = useTranslations("settings");
  const failure = useFailure();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      toast(t("passwordChanged"));
    } catch (caught) {
      setError(failure(caught));
    } finally {
      setSaving(false);
    }
  };

  // An account that only ever arrived through Google or GitHub has no password,
  // so a form asking for the current one has no correct answer. Saying why beats
  // hiding the section: its absence would read as a missing feature.
  if (!hasPassword) {
    return (
      <Card as="section" className="mt-5 p-6">
        <p className="text-small font-medium text-ink">{t("password")}</p>
        <p className="pt-2 text-small text-ink-2">{t("passwordViaProvider")}</p>
      </Card>
    );
  }

  return (
    <Card as="section" className="mt-5 p-6">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <p className="text-small font-medium text-ink">{t("password")}</p>
        <Input
          id="settings-current-password"
          type="password"
          autoComplete="current-password"
          label={t("currentPassword")}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Input
          id="settings-new-password"
          type="password"
          autoComplete="new-password"
          label={t("newPassword")}
          note={t("passwordNote")}
          error={error ?? undefined}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!current || !next}>
            {saving ? t("changing") : t("changePassword")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// --- The key that pays for the thinking ---
//
// Three states and each says something different, so the section says which one
// it is in plain words rather than showing an empty field: your own key, the
// server's key, or none at all, which is the state where writing an entry and
// both chats stop working.

function GeminiSection({
  account,
  onSaved,
  toast,
}: {
  account: Account;
  onSaved: (account: Account) => void;
  toast: Toast;
}) {
  const t = useTranslations("settings");
  const failure = useFailure();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const source = account.geminiKey;
  // A stored key is a settled thing, not a blank waiting to be filled. The field
  // used to stand open with its placeholder whether or not an account had one,
  // so the screen looked the same before and after saving and read as an
  // invitation to type the key again. Editing is a mode you enter.
  const [editing, setEditing] = useState(false);

  const run = async (action: () => Promise<{ geminiKey: Account["geminiKey"] }>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await action();
      onSaved({ ...account, geminiKey: saved.geminiKey });
      setKey("");
      setEditing(false);
      toast(done);
    } catch (caught) {
      // In the field rather than in a toast: the key is what was wrong, and a
      // message that slides away leaves nothing to correct against.
      setError(failure(caught));
    } finally {
      setBusy(false);
    }
  };

  const stored = source === "user" && !editing;

  return (
    <section className="mt-8 border-t border-hairline pt-7">
      <SectionHeader title={t("gemini")} icon={<IconKey />} />

      <Card className="p-6">
        <p className="max-w-[62ch] text-small text-ink-2">{t(`geminiState.${source}`)}</p>

        {stored ? (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
            {/* Three tellings of one fact went to one word. Above this row the
                heading already reads "Gemini key" and the paragraph says whose
                key is paying; the label repeated it a third time over a row of
                dots standing in for a value the server never returns. A second
                key mark here would have been the fourth. */}
            <p className="min-w-0 text-small text-laurel">{t("geminiStored")}</p>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                {t("geminiReplace")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void run(clearGeminiKey, t("geminiRemoved"))}
              >
                {t("geminiRemove")}
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => saveGeminiKey(key.trim()), t("geminiSaved"));
            }}
            className="pt-5"
          >
            <Input
              id="settings-gemini-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoFocus={editing}
              label={t("geminiLabel")}
              placeholder={t("geminiHint")}
              note={t("geminiNote")}
              error={error ?? undefined}
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <a
                href={GEMINI_KEY_CONSOLE}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  void openExternal(GEMINI_KEY_CONSOLE);
                }}
                className="text-small text-thread underline underline-offset-2"
              >
                {t("geminiWhere")}
              </a>
              <div className="flex gap-3">
                {editing ? (
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setKey("");
                      setError(null);
                    }}
                  >
                    {t("cancel")}
                  </Button>
                ) : null}
                <Button type="submit" loading={busy} disabled={!key.trim()}>
                  {busy ? t("geminiChecking") : t("save")}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}

// --- What a coder may do without asking ---

function PermissionSection({
  account,
  onSaved,
  toast,
}: {
  account: Account;
  onSaved: (account: Account) => void;
  toast: Toast;
}) {
  const t = useTranslations("settings");
  const failure = useFailure();
  const [saving, setSaving] = useState(false);

  const flip = async () => {
    setSaving(true);
    try {
      const saved = await setAllPermission(!account.allPermission);
      onSaved({ ...account, allPermission: saved.allPermission });
      toast(saved.allPermission ? t("autoApproveOn") : t("autoApproveOff"));
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 border-t border-hairline pt-7">
      <SectionHeader title={t("autoApprove")} icon={<IconAutoApprove />} />
      <Card className="flex flex-wrap items-center justify-between gap-5 p-6">
        <p className="max-w-[54ch] text-small text-ink-2">
          {account.allPermission ? t("autoApproveIsOn") : t("autoApproveIsOff")}
        </p>
        <Button variant="secondary" onClick={flip} loading={saving}>
          {account.allPermission ? t("turnOff") : t("turnOn")}
        </Button>
      </Card>
    </section>
  );
}

// --- Tokens: what a coder connects with ---

function TokensSection({ toast }: { toast: Toast }) {
  const t = useTranslations("settings");
  const failure = useFailure();

  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

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

  return (
    <section className="mt-8 border-t border-hairline pt-7">
      <SectionHeader
        title={t("tokens")}
        count={tokens?.length}
        icon={<IconToken />}
        note={t("tokensLead")}
      />

      {/* Shown once and never again, so it sits above the list where it cannot
          be scrolled past. */}
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

      <Card className="flex flex-wrap items-end gap-5 p-6">
        <div className="min-w-[200px] flex-1">
          <Input
            id="settings-token-label"
            label={t("tokenLabel")}
            placeholder={t("tokenPlaceholder")}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        {/* No archive to pick. A token stands for a machine and reaches every
            archive this account belongs to; the repository a coder is standing
            in decides which project it opens. */}
        <Button onClick={mint} loading={working === "mint"}>
          {working === "mint" ? t("minting") : t("mint")}
        </Button>
      </Card>

      <div className="pt-5">
        {tokens === null ? (
          <p className="text-body text-ink-3">{t("loading")}</p>
        ) : tokens.length === 0 ? (
          <EmptyState title={t("tokensEmpty")} note={t("tokensEmptyNote")} />
        ) : (
          // divide-y, not per-row borders: a border on the last row plus the
          // next section's own top border drew a double line into the gap.
          <ul className="divide-y divide-hairline">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-body text-ink">{token.label || t("noLabel")}</p>
                  <div className="pt-1">
                    <Meta items={[token.lastUsedAt ? t("used") : t("neverUsed")]} />
                  </div>
                </div>
                <Button
                  variant="quiet"
                  onClick={() => revoke(token.id)}
                  loading={working === token.id}
                >
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// --- Skills: what the coders on this machine can reach ---
//
// The one section on this screen that never touches the backend. Agent skills
// are directories on the disk this window runs on, one root per tool, and a
// skill sitting in one root is invisible to a tool that reads another. The
// button opens the missing doors between them, in every direction.
//
// No list, no browser, no per-skill switches. State plus one action, the same
// shape as the tokens above: the reader is not here to curate skills, they are
// here to find out that Codex is reading one of fifty-eight and fix it.

type SkillsMode = "checking" | "browser" | "ready" | "failed";

function SkillsSection({ toast }: { toast: Toast }) {
  const t = useTranslations("settings");

  const [mode, setMode] = useState<SkillsMode>("checking");
  const [state, setState] = useState<SkillsState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    // Read after mount, never in the initialiser: these screens are prerendered
    // where there is no window at all, and `npm run dev` serves the same export
    // in a browser where the disk is out of reach.
    if (!inApp()) {
      setMode("browser");
      return;
    }
    void scanSkills()
      .then((scan) => {
        setState(summarise(scan));
        setMode("ready");
      })
      .catch(() => setMode("failed"));
  }, []);

  useEffect(load, [load]);

  const link = async () => {
    setBusy(true);
    try {
      const report = await linkAllSkills();
      const notes = [t("skillsLinked", { count: report.created.length })];
      // Two different reasons to leave something alone, and both are the kind of
      // silence that reads as a bug. A name held by two different directories is
      // a person's decision; a refusal is the system's.
      if (report.conflicts.length) {
        notes.push(t("skillsConflicts", { count: report.conflicts.length }));
      }
      if (report.failed.length) {
        notes.push(t("skillsFailedCount", { count: report.failed.length }));
      }
      toast(notes.join(" "));
      load();
    } catch {
      toast(t("skillsError"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 border-t border-hairline pt-7">
      <SectionHeader title={t("skills")} icon={<IconSkills />} note={t("skillsLead")} />

      {mode === "checking" ? (
        <p className="text-body text-ink-3">{t("loading")}</p>
      ) : mode === "browser" ? (
        <p className="max-w-[62ch] text-body text-ink-2">{t("skillsBrowserOnly")}</p>
      ) : mode === "failed" || !state ? (
        <EmptyState
          title={t("skillsError")}
          note={t("skillsErrorNote")}
          action={
            <Button variant="secondary" onClick={load}>
              {t("retry")}
            </Button>
          }
        />
      ) : (
        <>
          <Card className="divide-y divide-hairline p-6 pt-4">
            {state.roots.map((root) => (
              <div
                key={root.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
              >
                <div className="min-w-0">
                  <p className="text-body text-ink">{t(`skillsRoot.${root.id}`)}</p>
                  <p className="truncate pt-1 font-data text-data text-ink-3">{root.path}</p>
                </div>
                <p className="shrink-0 text-data tabular text-ink-2">
                  {root.exists
                    ? t("skillsSeen", { seen: root.seen, total: state.total })
                    : t("skillsMissingRoot")}
                </p>
              </div>
            ))}
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-5 pt-5">
            <p className="max-w-[54ch] text-small text-ink-2">
              {state.missing
                ? t("skillsRestartNote")
                : t("skillsAllShared")}
              {/* Reported, not repaired: mending a dead link means deleting it,
                  and nothing in this feature deletes. */}
              {state.broken ? ` ${t("skillsBroken", { count: state.broken })}` : ""}
            </p>
            <Button onClick={link} loading={busy} disabled={state.missing === 0}>
              {busy
                ? t("skillsLinking")
                : t("skillsShare", { count: state.missing })}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

// --- Team: who else reads this archive ---

