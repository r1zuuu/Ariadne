"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { LOCALES, useLocale } from "@/app/locale-provider";
import { useApp } from "@/components/app-provider";
import { CommandBlock } from "@/components/command-block";
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
  acceptInvite,
  ApiError,
  changePassword,
  createInvite,
  createWorkspace,
  deleteToken,
  getAccount,
  listInvites,
  listMembers,
  listTokens,
  listWorkspaces,
  mintToken,
  removeMember,
  revokeInvite,
  saveProfile,
  setAllPermission,
  type Account,
  type ApiToken,
  type Invite,
  type Member,
  type Workspace,
} from "@/lib/api";

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
      .catch(() => setAccountError(true));
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
          <PermissionSection account={account} onSaved={setAccount} toast={toast} />
          <TokensSection toast={toast} />
          <TeamSection account={account} toast={toast} />
        </>
      )}
    </div>
  );
}

type Toast = ReturnType<typeof useToast>;

/** The one message a failed request turns into, wherever it failed. */
function useFailure() {
  const t = useTranslations("settings");
  return (error: unknown) =>
    error instanceof ApiError && error.message ? error.message : t("failed");
}

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
      <SectionHeader title={t("account")} />

      {/* Read-only facts get a hairline, not a card: there is nothing here to
          decide about. */}
      <div className="border-b border-hairline pb-5">
        <p className="text-body text-ink">{account.email}</p>
        <div className="pt-2">
          <Meta items={[t("memberSince", { at: new Date(account.createdAt).getFullYear() })]} />
        </div>
      </div>

      <Card className="mt-5 p-6">
        <Textarea
          id="settings-profile"
          label={t("profile")}
          note={t("profileNote")}
          rows={5}
          value={profile}
          onChange={(event) => setProfile(event.target.value)}
        />
        <div className="flex justify-end pt-5">
          <Button onClick={save} loading={saving} disabled={profile === account.profile}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </Card>

      <PasswordCard toast={toast} />

      <div className="flex flex-wrap items-center gap-4 pt-6">
        <p className="text-small font-medium text-ink">{t("language")}</p>
        {LOCALES.map((code) => (
          <Button
            key={code}
            variant={code === locale ? "primary" : "secondary"}
            onClick={() => setLocale(code)}
          >
            {t(`languages.${code}`)}
          </Button>
        ))}
      </div>
    </section>
  );
}

function PasswordCard({ toast }: { toast: Toast }) {
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
    <section className="mt-10 border-t border-hairline pt-8">
      <SectionHeader title={t("autoApprove")} />
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [label, setLabel] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    void listTokens().then(setTokens).catch(() => setTokens([]));
  }, []);

  useEffect(() => {
    load();
    void listWorkspaces()
      .then((rows) => {
        setWorkspaces(rows);
        setWorkspaceId(rows[0]?.id ?? "");
      })
      .catch(() => {});
  }, [load]);

  const mint = async () => {
    setWorking("mint");
    try {
      const minted = await mintToken(label.trim(), workspaceId || undefined);
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
    <section className="mt-10 border-t border-hairline pt-8">
      <SectionHeader title={t("tokens")} count={tokens?.length} />
      <p className="pb-5 text-small text-ink-2">{t("tokensLead")}</p>

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
        {/* Only when there is a choice to make. With one archive the question
            has one answer and asking it is noise. */}
        {workspaces.length > 1 ? (
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="settings-token-workspace"
              className="block pb-2 text-small font-medium text-ink"
            >
              {t("forWorkspace")}
            </label>
            <select
              id="settings-token-workspace"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className="h-[44px] w-full rounded-control border border-edge/60 bg-surface px-5 text-body text-ink outline-none transition-colors duration-state focus:border-thread focus:ring-2 focus:ring-thread/15"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
          <ul>
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-body text-ink">{token.label || t("noLabel")}</p>
                  <div className="pt-1">
                    {/* Which archive it reaches, but only once there is more
                        than one. With a single workspace this repeats the same
                        name under every token, and that name is an address. */}
                    <Meta
                      items={[
                        workspaces.length > 1 ? token.workspaceName : null,
                        token.lastUsedAt ? t("used") : t("neverUsed"),
                      ]}
                    />
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

// --- Team: who else reads this archive ---

function TeamSection({ account, toast }: { account: Account; toast: Toast }) {
  const t = useTranslations("settings");
  const failure = useFailure();
  const { refreshProjects, refreshPending } = useApp();

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    void listWorkspaces()
      .then((rows) => {
        setWorkspaces(rows);
        setOpenId((current) => (rows.some((w) => w.id === current) ? current : (rows[0]?.id ?? null)));
      })
      .catch(() => setWorkspaces([]));
  }, []);

  useEffect(load, [load]);

  const loadOpen = useCallback(() => {
    if (!openId) return;
    void listMembers(openId).then(setMembers).catch(() => setMembers([]));
    void listInvites(openId).then(setInvites).catch(() => setInvites([]));
  }, [openId]);

  useEffect(loadOpen, [loadOpen]);

  const act = async (key: string, run: () => Promise<void>, done: string) => {
    setWorking(key);
    try {
      await run();
      toast(done);
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setWorking(null);
    }
  };

  const open = workspaces?.find((w) => w.id === openId) ?? null;

  return (
    <section className="mt-10 border-t border-hairline pt-8">
      <SectionHeader title={t("team")} />
      <p className="pb-5 text-small text-ink-2">{t("teamLead")}</p>

      {workspaces === null ? (
        <p className="text-body text-ink-3">{t("loading")}</p>
      ) : (
        <>
          {/* One row per archive. Switching only changes what the two lists
              below are about, so it is a row of choices and not navigation. */}
          <ul className="flex flex-wrap gap-2 pb-5">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Button
                  variant={workspace.id === openId ? "primary" : "secondary"}
                  onClick={() => setOpenId(workspace.id)}
                >
                  {workspace.name}
                </Button>
              </li>
            ))}
          </ul>

          {open ? (
            <>
              <div className="border-b border-hairline pb-5">
                <Meta
                  items={[
                    open.isOwner ? t("roles.owner") : t("roles.member"),
                    t("memberCount", { count: open.memberCount }),
                  ]}
                />
              </div>

              <ul className="pb-6">
                {members.map((member) => {
                  const self = member.userId === account.id;
                  return (
                    <li
                      key={member.userId}
                      className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-body text-ink">
                          {member.email}
                          {self ? ` ${t("you")}` : ""}
                        </p>
                        <div className="pt-1">
                          <Meta items={[t(`roles.${member.role}`)]} />
                        </div>
                      </div>
                      {/* The owner cannot be removed and cannot walk out, so the
                          button is simply absent rather than shown and refused. */}
                      {member.role !== "owner" && (self || open.isOwner) ? (
                        <Button
                          variant="quiet"
                          loading={working === member.userId}
                          onClick={() =>
                            act(
                              member.userId,
                              async () => {
                                await removeMember(open.id, member.userId);
                                if (self) load();
                                else loadOpen();
                              },
                              self ? t("left") : t("removed"),
                            )
                          }
                        >
                          {self ? t("leave") : t("remove")}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <Card className="flex flex-wrap items-end gap-5 p-6">
                <div className="min-w-[220px] flex-1">
                  <Input
                    id="settings-invite-email"
                    type="email"
                    label={t("inviteEmail")}
                    note={t("inviteEmailNote")}
                    placeholder={t("inviteEmailPlaceholder")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <Button
                  loading={working === "invite"}
                  onClick={() =>
                    act(
                      "invite",
                      async () => {
                        await createInvite(open.id, email.trim() || null);
                        setEmail("");
                        loadOpen();
                      },
                      t("inviteCreated"),
                    )
                  }
                >
                  {t("createInvite")}
                </Button>
              </Card>

              {invites.length ? (
                <ul className="pt-5">
                  {invites.map((invite) => (
                    <li key={invite.id} className="border-b border-hairline py-4">
                      <CommandBlock
                        command={invite.code}
                        what={invite.email ? t("inviteFor", { at: invite.email }) : t("inviteOpen")}
                        where={t("inviteWhere")}
                        copyLabel={t("copyCode")}
                      />
                      <div className="flex items-center justify-between gap-4 pt-3">
                        <Meta
                          items={[
                            t("inviteExpires", {
                              at: new Date(invite.expiresAt).toLocaleDateString(),
                            }),
                          ]}
                        />
                        <Button
                          variant="quiet"
                          loading={working === invite.id}
                          onClick={() =>
                            act(
                              invite.id,
                              async () => {
                                await revokeInvite(invite.id);
                                loadOpen();
                              },
                              t("inviteRevoked"),
                            )
                          }
                        >
                          {t("revoke")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          <div className="grid gap-5 pt-8 sm:grid-cols-2">
            <Card className="p-6">
              <Input
                id="settings-workspace-name"
                label={t("newWorkspace")}
                note={t("newWorkspaceNote")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="flex justify-end pt-5">
                <Button
                  variant="secondary"
                  disabled={!name.trim()}
                  loading={working === "create"}
                  onClick={() =>
                    act(
                      "create",
                      async () => {
                        const created = await createWorkspace(name.trim());
                        setName("");
                        setOpenId(created.id);
                        load();
                      },
                      t("workspaceCreated"),
                    )
                  }
                >
                  {t("create")}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <Input
                id="settings-join-code"
                label={t("joinCode")}
                note={t("joinCodeNote")}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <div className="flex justify-end pt-5">
                <Button
                  variant="secondary"
                  disabled={!code.trim()}
                  loading={working === "join"}
                  onClick={() =>
                    act(
                      "join",
                      async () => {
                        await acceptInvite(code.trim());
                        setCode("");
                        // Joining changed what the account can see; the shared
                        // context re-reads it in place, no reload needed.
                        load();
                        await Promise.all([refreshProjects(), refreshPending()]);
                      },
                      t("joined"),
                    )
                  }
                >
                  {t("join")}
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
