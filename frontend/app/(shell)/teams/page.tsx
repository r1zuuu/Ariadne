"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/components/app-provider";
import { CommandBlock } from "@/components/command-block";
import { useFailure } from "@/components/failure";
import { IconEnter, IconGroup } from "@/components/icons";
import { Collapse, FadeIn } from "@/components/motion";
import { MemberMarks } from "@/components/project-marks";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Meta,
  PageHeader,
  SectionHeader,
  Status,
} from "@/components/ui";
import {
  acceptInvite,
  ApiError,
  createInvite,
  createWorkspace,
  declineInvite,
  getAccount,
  listInvites,
  listMembers,
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
// Two questions arrive at this screen and only one of them is ever yours: either
// somebody let you in somewhere, or you are looking after archives you already
// have. The first has a deadline on it, the second does not. Laid out one under
// another they read as one long list of equal things, which is what this screen
// used to be: invitations, teams, private archives and a founding form, four
// sections at one weight down a page nobody scrolled.
//
// So the screen opens on the two doors instead, and the doors carry what is
// behind them: an ochre count when somebody is waiting, a quiet metadata line
// when it is only your own shelves. Colour picks the door with the deadline,
// which is the one thing colour is for in this product. Founding an archive is
// not a third door - it is something you do once you are already inside your
// own, so it lives there as an action on the heading.

type View = "doors" | "join" | "mine";

export default function TeamsScreen() {
  const t = useTranslations("teams");
  const { workspaces, invitations, membershipRead } = useApp();
  const [view, setView] = useState<View>("doors");
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    void getAccount()
      .then((account) => setAccountId(account.id))
      .catch(() => {});
  }, []);

  // A team is an archive more than one person reaches, or one you were let into.
  // Everything else is yours alone.
  const teams = workspaces.filter((w) => w.memberCount > 1 || !w.isOwner);
  const mine = workspaces.filter((w) => w.memberCount === 1 && w.isOwner);

  return (
    <div className="mx-auto max-w-[860px]">
      {/* Keyed on the view, so passing through a door is the same 200ms arrival
          every other screen change in the app uses. */}
      <FadeIn key={view}>
        {view === "doors" ? (
          <>
            <PageHeader title={t("title")} lead={t("lead")} />
            <Doors
              read={membershipRead}
              waiting={invitations.length}
              archives={workspaces.length}
              shared={teams.length}
              onPick={setView}
            />
          </>
        ) : view === "join" ? (
          <JoinPanel
            invitations={invitations}
            onBack={() => setView("doors")}
            // Joining answers "where did it go" by putting you in front of the
            // archive you just entered.
            onJoined={() => setView("mine")}
          />
        ) : (
          <MyTeams
            teams={teams}
            mine={mine}
            accountId={accountId}
            onBack={() => setView("doors")}
          />
        )}
      </FadeIn>
    </div>
  );
}

// --- The two doors ---

function Doors({
  read,
  waiting,
  archives,
  shared,
  onPick,
}: {
  /** Whether the counts under these doors are answers rather than starting
   *  values. Until they are, the second door says nothing about what is behind
   *  it rather than saying "0 archives" and correcting itself a second later.
   *  The first door needs no such guard: it is silent unless something waits. */
  read: boolean;
  waiting: number;
  archives: number;
  shared: number;
  onPick: (view: View) => void;
}) {
  const t = useTranslations("teams");

  return (
    <div className="grid gap-5 pb-9 md:grid-cols-[1fr_auto_1fr] md:gap-6">
      <Door
        title={t("doors.join.title")}
        note={t("doors.join.note")}
        icon={<IconEnter />}
        onClick={() => onPick("join")}
        // Nothing waiting says nothing. The sentence under the name already
        // tells you what the door is for, so a line announcing an absence was
        // filler standing in the one place a count stands, and it made the
        // quiet case look like the busy one with worse news.
        state={
          waiting ? (
            <Status tone="proposed">{t("doors.join.waiting", { count: waiting })}</Status>
          ) : null
        }
      />

      {/* The fork in the path: one hairline, the word on it, nothing else. */}
      <div className="flex items-center justify-center gap-4 md:flex-col">
        <span aria-hidden="true" className="h-px flex-1 bg-hairline md:h-auto md:w-px" />
        <span className="text-label uppercase tracking-[0.12em] text-ink-3">{t("or")}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-hairline md:h-auto md:w-px" />
      </div>

      <Door
        title={t("doors.mine.title")}
        note={t("doors.mine.note")}
        icon={<IconGroup />}
        onClick={() => onPick("mine")}
        state={
          read ? (
            <Meta
              items={[
                t("doors.mine.archives", { count: archives }),
                shared ? t("doors.mine.shared", { count: shared }) : t("private"),
              ]}
            />
          ) : null
        }
      />
    </div>
  );
}

/**
 * One of the two. A square you press, not a card you read.
 *
 * Read top to bottom it is a poster: what is behind the door first - the ochre
 * count, or the quiet line saying nothing waits - then the mark, then the name
 * of the door at the foot of it, where a door's name is.
 *
 * Mark, name and sentence are one block at the foot, and the square's slack all
 * sits above it. Splitting the slack either side of the mark was the first go
 * and it left the mark floating in the middle of nothing, which reads as a
 * placeholder; hanging it off the name makes it part of what it names. The mark
 * is what the square is for: the two doors differ by silhouette before either
 * word is read, and that is the whole reason a choice is offered as two shapes
 * rather than as two lines of text.
 *
 * The name is set by hand in the display serif rather than as an h2, because a
 * heading is flow content and this is the inside of a button. The button's own
 * text is its name in the accessibility tree, count and all.
 */
function Door({
  title,
  note,
  icon,
  state,
  onClick,
}: {
  title: string;
  note: string;
  icon: ReactNode;
  state: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[220px] w-full flex-col items-start rounded-card border border-hairline bg-surface p-7 text-left shadow-card transition-colors duration-state hover:border-edge hover:bg-surface-2 md:aspect-square"
    >
      <span className="flex w-full items-center justify-between gap-4">
        {state}
        {/* The one thing that separates a door from a panel: it goes somewhere,
            and under the pointer the way it goes takes up the thread. */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          // ml-auto and not only justify-between: the state beside it is absent
          // until the lists have been read, and a lone child in a
          // justify-between row goes to the wrong end.
          className="ml-auto shrink-0 text-ink-3 transition-colors duration-state group-hover:text-thread"
        >
          <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" />
        </svg>
      </span>
      {/* Quiet on its own, and it warms with the arrow under the pointer: one
          door, one hover, rather than two things lighting up separately. */}
      <span className="mt-auto text-ink-3 transition-colors duration-state group-hover:text-ink-2">
        {icon}
      </span>
      <span className="pt-5 display-serif text-title text-ink">{title}</span>
      <span className="max-w-[34ch] pt-3 text-small text-ink-2">{note}</span>
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  const t = useTranslations("teams");
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 mt-5 inline-flex items-center gap-2 rounded-control px-2 py-1 text-small text-ink-2 transition-colors duration-state hover:text-ink"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8.5 3.5 4 8l4.5 4.5M4 8h8" />
      </svg>
      {t("back")}
    </button>
  );
}

// --- Behind the first door: what is waiting, and the code you were sent ---

/**
 * Two ways in, in the order they cost the reader something. An invitation
 * written to this address is already here and takes one press. A code handed
 * over by hand has to be typed, so it sits under the hairline - and when nothing
 * is waiting it is the whole screen, which is the case that had no home at all
 * before: acceptInvite existed, the wizard and the settings called it, and this
 * screen offered nowhere to paste one.
 */
function JoinPanel({
  invitations,
  onBack,
  onJoined,
}: {
  invitations: MyInvite[];
  onBack: () => void;
  onJoined: () => void;
}) {
  const t = useTranslations("teams");
  const toast = useToast();
  const failure = useFailure();
  const { refreshMembership, refreshProjects } = useApp();

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

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

  const join = async (invite: MyInvite) =>
    act(
      invite.id,
      async () => {
        // The code is the key, not the id: accepting is the same act whether the
        // code arrived by hand or was read off this screen.
        await acceptInvite(invite.code);
        await Promise.all([refreshMembership(), refreshProjects()]);
        onJoined();
      },
      t("joined", { team: invite.workspaceName }),
    );

  const joinByCode = async () => {
    const typed = code.trim();
    if (!typed) {
      setCodeError(t("code.errorEmpty"));
      return;
    }
    setCodeError(null);
    setWorking("code");
    try {
      const workspace = await acceptInvite(typed);
      setCode("");
      await Promise.all([refreshMembership(), refreshProjects()]);
      toast(t("joined", { team: workspace.name }));
      onJoined();
    } catch (error) {
      // A refused code is the reader's mistake to fix while it is still on
      // screen, so it stays under the field instead of leaving in a toast.
      if (error instanceof ApiError && (error.status === 404 || error.status === 401)) {
        setCodeError(t("code.errorBad"));
      } else {
        toast(failure(error), "error");
      }
    } finally {
      setWorking(null);
    }
  };

  // The field, wherever it ends up: the two arrangements below differ in what
  // sits around it, never in what it is.
  const field = (
    <div className="max-w-[46ch]">
      <Input
        id="invite-code"
        label={t("code.label")}
        note={t("code.note")}
        placeholder={t("code.placeholder")}
        error={codeError ?? undefined}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void joinByCode();
        }}
      />
      <div className="flex justify-end pt-4">
        <Button loading={working === "code"} onClick={() => void joinByCode()}>
          {t("join")}
        </Button>
      </div>
    </div>
  );

  // Nothing waiting is the ordinary case, and then this screen is one field.
  //
  // It used to arrive as a 64px title, a section heading under it saying much
  // the same thing, a paragraph, a labelled input and a button, all stacked
  // down the left third of an 860px page with the rest of the window empty
  // beside and below them. A form does not look considered when it is holding
  // one corner of a screen it never fills. Centred, in the arrangement the
  // other single-field screen in this app already uses - the question over the
  // field, both in the middle of the space they have - it reads as the whole
  // point of the screen, which is what it is.
  if (!invitations.length) {
    return (
      <div className="flex screen-opening flex-col">
        <BackLink onClick={onBack} />
        <div className="my-auto pb-9">
          <div className="pb-7 text-center">
            <h1 className="mx-auto max-w-[16ch] text-display text-ink">
              {t("doors.join.title")}
            </h1>
            {/* text-balance, not a narrower measure: centred and left to
                itself this sentence put "tutaj." alone on a second line, and
                the browser evens the lines out better than a guessed width
                can, in any of the two languages. */}
            <p className="mx-auto max-w-[62ch] text-balance pt-4 text-body text-ink-2">
              {t("code.leadAlone")}
            </p>
          </div>
          <div className="mx-auto w-fit">{field}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <BackLink onClick={onBack} />
      <PageHeader title={t("doors.join.title")} />

      <section className="pb-9">
        <SectionHeader title={t("waiting")} count={invitations.length} />
          <ul className="flex flex-col gap-4">
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
                    <Button loading={working === invite.id} onClick={() => void join(invite)}>
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
                            await refreshMembership();
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

      {/* Second here, and under a hairline: something is actually waiting above
          it, and a code typed by hand is the way in for the invitation that
          did not arrive. */}
      <section className="border-t border-hairline pt-7">
        <SectionHeader title={t("code.title")} note={t("code.lead")} />
        {field}
      </section>
    </>
  );
}

// --- Behind the second door: the archives you already have ---

function MyTeams({
  teams,
  mine,
  accountId,
  onBack,
}: {
  teams: Workspace[];
  mine: Workspace[];
  accountId: string | null;
  onBack: () => void;
}) {
  const t = useTranslations("teams");
  const { projects, refreshMembership, refreshProjects } = useApp();
  const [founding, setFounding] = useState(false);

  const changed = useCallback(async () => {
    await Promise.all([refreshMembership(), refreshProjects()]);
  }, [refreshMembership, refreshProjects]);

  return (
    <>
      <BackLink onClick={onBack} />
      <PageHeader
        title={t("doors.mine.title")}
        actions={
          <Button variant="secondary" onClick={() => setFounding(!founding)}>
            {founding ? t("cancel") : t("newTeam")}
          </Button>
        }
      />

      {/* The third act. Not a door and not a section at the bottom of the page:
          founding an archive is something you do while looking at the ones you
          already have, so it opens out of the heading that names them. */}
      <Collapse open={founding}>
        <div className="pb-7">
          <NewTeam
            onCreated={async () => {
              setFounding(false);
              await changed();
            }}
          />
        </div>
      </Collapse>

      <section>
        <SectionHeader title={t("shared")} count={teams.length || undefined} />
        {teams.length ? (
          <ul className="flex flex-col gap-4">
            {teams.map((workspace) => (
              <li key={workspace.id}>
                <TeamCard
                  workspace={workspace}
                  projects={projects ?? []}
                  accountId={accountId}
                  onChanged={changed}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("noTeams")} note={t("noTeamsNote")} />
        )}
      </section>

      {mine.length ? (
        <section className="pt-9">
          <SectionHeader title={t("private")} />
          <p className="max-w-[70ch] pb-4 text-small text-ink-2">{t("privateNote")}</p>
          <ul className="flex flex-col gap-4">
            {mine.map((workspace) => (
              <li key={workspace.id}>
                <TeamCard
                  workspace={workspace}
                  projects={projects ?? []}
                  accountId={accountId}
                  onChanged={changed}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
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
                            if (!self) loadDetail();
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

function NewTeam({ onCreated }: { onCreated: () => Promise<void> | void }) {
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
      await onCreated();
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <Input
        id="new-team-name"
        label={t("newTeamName")}
        note={t("newTeamNote")}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="flex justify-end pt-4">
        <Button disabled={!name.trim()} loading={busy} onClick={() => void create()}>
          {t("createTeam")}
        </Button>
      </div>
    </Card>
  );
}
