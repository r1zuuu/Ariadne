"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/components/app-provider";
import type { Project, Workspace } from "@/lib/api";

// Which archive a project sits in, and who else can read it.
//
// None of this was on screen. A project shared with a teammate looked exactly
// like a private one, so the only way to find out was the settings screen, and
// the failure it hides is quiet: you write entries into a drawer nobody else
// opens and find out weeks later. The backend has returned workspaceName with
// every project all along; nothing displayed it.

/** Two letters from an address. There are no avatars: sign-in asks a provider
 *  for an email and a profile, never a picture. */
export function initialsOf(email: string): string {
  if (!email) return "?";
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Where this project lives, told from what the provider already holds.
 *
 * `sameRepoElsewhere` is the trap that started this: two projects in two of your
 * archives can carry one repository address, and a coder resolves that address
 * inside the archive its token belongs to. It picks one, says nothing, and half
 * your entries land where the other half cannot see them. The comparison is a
 * plain string match because the server normalises repo_ref before storing it,
 * so both sides are already in one spelling.
 */
export function useProjectPlacement(project: Project | null) {
  const { workspaces, projects } = useApp();

  const workspace: Workspace | undefined = project
    ? workspaces.find((w) => w.id === project.workspaceId)
    : undefined;

  const sameRepoElsewhere = (projects ?? []).filter(
    (other) =>
      project &&
      other.id !== project.id &&
      other.repoRef === project.repoRef &&
      other.workspaceId !== project.workspaceId,
  );

  return {
    workspace,
    /** More than one person can read it, so it is somebody else's work too. */
    shared: (workspace?.memberCount ?? 1) > 1,
    /** The addresses, or none if this server does not send them yet. */
    members: workspace?.members ?? [],
    /** Worth naming the archive only when there is more than one to confuse. */
    showWorkspace: workspaces.length > 1,
    sameRepoElsewhere,
  };
}

export function MemberMarks({ emails, max = 3 }: { emails?: string[]; max?: number }) {
  // Absent, not merely empty. A server one deploy behind this build does not
  // send the field at all, and a component that renders a list has no business
  // taking the whole screen down when the list is missing - every deploy has a
  // window where the two sides disagree, and the answer to that is to draw
  // nothing, not to throw.
  const all = emails ?? [];
  const shown = all.slice(0, max);
  const rest = all.length - shown.length;
  if (!shown.length) return null;

  return (
    // Overlapped, which is what says "these are one group" rather than three
    // separate badges. title on each, because an initial is a hint and the
    // address is the answer.
    <span className="flex items-center -space-x-1.5">
      {shown.map((email) => (
        <span
          key={email}
          title={email}
          className="grid h-[22px] w-[22px] place-items-center rounded-pill border border-edge bg-surface-2 text-[10px] font-medium leading-none text-ink"
        >
          {initialsOf(email)}
        </span>
      ))}
      {rest > 0 ? (
        <span className="grid h-[22px] w-[22px] place-items-center rounded-pill border border-edge bg-surface-2 text-[10px] font-medium leading-none text-ink-2">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The one-line answer to "whose project am I looking at". Nothing at all on a
 * lone private project, which is the common case and needs no decoration.
 */
export function ProjectPlacement({ project }: { project: Project }) {
  const t = useTranslations("project");
  const { workspace, shared, showWorkspace } = useProjectPlacement(project);
  if (!workspace || (!shared && !showWorkspace)) return null;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {shared ? <MemberMarks emails={workspace.members ?? []} /> : null}
      <span className="truncate">
        {shared ? t("sharedIn", { name: workspace.name }) : workspace.name}
      </span>
    </span>
  );
}
