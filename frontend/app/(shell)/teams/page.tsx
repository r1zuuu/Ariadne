"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { CommandBlock } from "@/components/command-block";
import { useFailure } from "@/components/failure";
import { MemberMarks } from "@/components/project-marks";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, Input, Meta, PageHeader, SectionHeader } from "@/components/ui";
import {
  acceptInvite,
  createInvite,
  createWorkspace,
  declineInvite,
  getAccount,
  listInvites,
  listMembers,
  myInvites,
  removeMember,
  revokeInvite,
  type Invite,
  type Member,
  type MyInvite,
  type Project,
  type Workspace,
} from "@/lib/api";

// Screen 09. Who you work with, and on what.
//
// All of this existed already and none of it was findable: members, invitations
// and creating an archive lived at the bottom of the settings screen, past the
// account, the key, the approval switch and the tokens. Nothing anywhere said
// teams were a thing at all.
//
// The order down the page is the order the questions arrive in. Somebody is
// waiting for you first, because it is the only part with a deadline. Then the
// teams you are in, each showing the projects inside it - that nesting is the
// whole model and it had never been drawn. Your own archive last, named as what
// it is: a team of one, an invitation away from being a team.

export default function TeamsScreen() {
  const t = useTranslations("teams");
  const toast = useToast();
  const failure = useFailure();
  const { workspaces, projects, refreshProjects } = useApp();

  const [invitations, setInvitations] = useState<MyInvite[] | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const loadInvitations = useCallback(() => {
    void myInvites()
      .then(setInvitations)
      .catch(() => setInvitations([]));
  }, []);

  useEffect(loadInvitations, [loadInvitations]);
  useEffect(() => {
    void getAccount()
      .then((account) => setAccountId(account.id))
      .catch(() => {});
  }, []);

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

  // A team is an archive more than one person reaches, or one you were let into.
  // Everything else is yours alone.
  const teams = workspaces.filter((w) => w.memberCount > 1 || !w.isOwner);
  const mine = workspaces.filter((w) => w.memberCount === 1 && w.isOwner);

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader title={t("title")} lead={t("lead")} />

      {invitations?.length ? (
        <section className="pb-9">
          <SectionHeader title={t("waiting")} count={invitations.length} />
          <ul className="flex flex-col gap-4 pt-4">
            {invitations.map((invite) => (
              <li key={invite.id}>
                {/* Ochre, the colour this application already uses for anything
                    proposed and unanswered, so an invitation reads the same way
                    an entry awaiting approval does. */}
                <Card className="border-ochre/40 p-6">
                  <p className="text-body text-ink">
                    {t("invitedTo", { team: invite.workspaceName })}
                  </p>
                  <div className="pt-2">
                    <Meta
                      items={[
                        invite.invitedBy
                          ? t("invitedBy", { who: invite.invitedBy })
                          : t("invitedByUnknown"),
                        t("expires", { at: new Date(invite.expiresAt).toLocaleDateString() }),
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-5">
                    <Button
                      loading={working === invite.id}
                      onClick={() =>
                        act(
                          invite.id,
                          async () => {
                            // The code is the key, not the id: accepting is the
                            // same act whether the code arrived by hand or was
                            // read off this screen.
                            await acceptInvite(invite.code);
                            loadInvitations();
                            await refreshProjects();
                          },
                          t("joined", { team: invite.workspaceName }),
                        )
                      }
                    >
                      {t("join")}
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={working === invite.id}
                      onClick={() =>
                        act(
                          invite.id,
                          async () => {
                            await declineInvite(invite.id);
                            loadInvitations();
                          },
                          t("declined"),
                        )
                      }
                    >
                      {t("decline")}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionHeader title={t("yours")} />
        {teams.length ? (
          <ul className="flex flex-col gap-4 pt-4">
            {teams.map((workspace) => (
              <li key={workspace.id}>
                <TeamCard
                  workspace={workspace}
                  projects={projects ?? []}
                  accountId={accountId}
                  onChanged={refreshProjects}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="pt-4">
            <EmptyState title={t("noTeams")} note={t("noTeamsNote")} />
          </div>
        )}
      </section>

      {mine.length ? (
        <section className="pt-9">
          <SectionHeader title={t("private")} />
          <p className="max-w-[70ch] pb-4 pt-2 text-small text-ink-2">{t("privateNote")}</p>
          <ul className="flex flex-col gap-4">
            {mine.map((workspace) => (
              <li key={workspace.id}>
                <TeamCard
                  workspace={workspace}
                  projects={projects ?? []}
                  accountId={accountId}
                  onChanged={refreshProjects}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <NewTeam onCreated={() => window.location.reload()} />
    </div>
  );
}

/**
 * One archive, with what is inside it and who can read it.
 *
 * The projects come from the provider's list, which already carries workspaceId
 * on every row, so drawing the nesting costs no request. Members and open
 * invitations are fetched only when the card is opened: they are two requests
 * per team and nobody needs them for a team they are not touching.
 */
function TeamCard({
  workspace,
  projects,
  accountId,
  onChanged,
}: {
  workspace: Workspace;
  projects: Project[];
  accountId: string | null;
  onChanged: () => Promise<void> | void;
}) {
  const t = useTranslations("teams");
  const toast = useToast();
  const failure = useFailure();

  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  const inside = projects.filter((p) => p.workspaceId === workspace.id);

  const loadDetail = useCallback(() => {
    if (!open) return;
    void listMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
    void listInvites(workspace.id).then(setInvites).catch(() => setInvites([]));
  }, [open, workspace.id]);

  useEffect(loadDetail, [loadDetail]);

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

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-section text-ink">{workspace.name}</p>
          <div className="pt-2">
            <Meta
              items={[
                workspace.isOwner ? t("roles.owner") : t("roles.member"),
                t("memberCount", { count: String(workspace.memberCount) }),
              ]}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <MemberMarks emails={workspace.members} />
          <Button variant="secondary" onClick={() => setOpen(!open)}>
            {open ? t("close") : t("manage")}
          </Button>
        </div>
      </div>

      {/* The nesting, drawn. A team holds projects and that was never on screen
          anywhere, which is why one repository ending up in two archives was
          invisible until a coder wrote to the wrong one. */}
      <div className="pt-5">
        <p className="text-label uppercase tracking-[0.12em] text-ink-3">{t("projectsIn")}</p>
        {inside.length ? (
          <ul className="divide-y divide-hairline pt-2">
            {inside.map((project) => (
              <li key={project.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <span className="text-body text-ink">{project.name}</span>
                <span className="font-mono text-data text-ink-3">{project.repoRef}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-2 text-small text-ink-3">{t("noProjects")}</p>
        )}
      </div>

      {open ? (
        <div className="mt-6 border-t border-hairline pt-6">
          <ul className="divide-y divide-hairline">
            {members.map((member) => {
              const self = member.userId === accountId;
              return (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-4 py-3"
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
                      button is absent rather than shown and refused. */}
                  {member.role !== "owner" && (self || workspace.isOwner) ? (
                    <Button
                      variant="quiet"
                      loading={working === member.userId}
                      onClick={() =>
                        act(
                          member.userId,
                          async () => {
                            await removeMember(workspace.id, member.userId);
                            if (self) window.location.reload();
                            else loadDetail();
                            await onChanged();
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

          {/* Field above, action below and to the right. items-end put the
              button level with the field's note rather than with the field,
              because the note is what makes that column taller - so the button
              sat visibly low. Same arrangement every other form in the app uses. */}
          <div className="pt-6">
            <Input
              id={`invite-${workspace.id}`}
              type="email"
              label={t("inviteEmail")}
              note={t("inviteEmailNote")}
              placeholder={t("inviteEmailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button
              loading={working === "invite"}
              onClick={() =>
                act(
                  "invite",
                  async () => {
                    await createInvite(workspace.id, email.trim() || null);
                    setEmail("");
                    loadDetail();
                  },
                  t("inviteCreated"),
                )
              }
            >
              {t("createInvite")}
            </Button>
          </div>

          {invites.length ? (
            <ul className="pt-5">
              {invites.map((invite) => (
                <li key={invite.id} className="border-t border-hairline py-4">
                  <CommandBlock
                    command={invite.code}
                    what={invite.email ? t("inviteFor", { at: invite.email }) : t("inviteOpen")}
                    where={t("inviteWhere")}
                    copyLabel={t("copyCode")}
                  />
                  <div className="flex items-center justify-between gap-4 pt-3">
                    <Meta
                      items={[
                        t("expires", { at: new Date(invite.expiresAt).toLocaleDateString() }),
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
                            loadDetail();
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
        </div>
      ) : null}
    </Card>
  );
}

function NewTeam({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("teams");
  const toast = useToast();
  const failure = useFailure();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await createWorkspace(name.trim());
      setName("");
      toast(t("teamCreated"));
      onCreated();
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pb-9 pt-9">
      <SectionHeader title={t("newTeam")} />
      <Card className="mt-4 p-6">
        <Input
          id="new-team-name"
          label={t("newTeamName")}
          note={t("newTeamNote")}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex justify-end pt-4">
          <Button
            variant="secondary"
            disabled={!name.trim()}
            loading={busy}
            onClick={() => void create()}
          >
            {t("createTeam")}
          </Button>
        </div>
      </Card>
    </section>
  );
}
