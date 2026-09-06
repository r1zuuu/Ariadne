"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/components/app-provider";
import {
  IconEntries,
  IconLimits,
  IconMap,
  IconRepo,
  IconStack,
  IconStage,
  IconTeams,
} from "@/components/icons";
import { MemoryGraph } from "@/components/memory-graph";
import { ProjectPlacement, useProjectPlacement } from "@/components/project-marks";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Meta,
  SectionHeader,
  Textarea,
} from "@/components/ui";
import {
  ApiError,
  deleteProject,
  getGraph,
  moveProject,
  updateProject,
  type GraphEdge,
  type Node,
  type Project,
} from "@/lib/api";

// Screen 04. The project as a profile to read, not a form to fill in.
//
// It used to open as six inputs, which gave every field the same weight and made
// the card look like configuration. Reading is the common case: you come here to
// check what the agent is told about this project. Editing is a mode you enter.

export default function ProjectScreen() {
  const t = useTranslations("project");
  const toast = useToast();
  const { projects, activeProject, refreshProjects, server } = useApp();

  const [graph, setGraph] = useState<{ nodes: Node[]; edges: GraphEdge[] } | null>(null);
  const [graphError, setGraphError] = useState(false);
  const [editing, setEditing] = useState(false);

  const project = activeProject;

  const loadGraph = useCallback((id: string) => {
    setGraph(null);
    setGraphError(false);
    void getGraph(id)
      .then(setGraph)
      // An unreachable map is an error with a retry, not an empty archive:
      // "no entries yet" and "the server did not answer" mean opposite things.
      .catch(() => setGraphError(true));
  }, []);

  useEffect(() => {
    if (project?.id) loadGraph(project.id);
  }, [project?.id, loadGraph]);

  return (
    <div className="mx-auto max-w-[1080px]">
        {project === null ? (
          server === "down" ? (
            // A dead backend used to park this screen on "loading" forever.
            // Say what happened and offer the one thing that can fix it.
            <EmptyState
              title={t("unreachable")}
              note={t("unreachableNote")}
              action={
                <Button variant="secondary" onClick={() => void refreshProjects()}>
                  {t("retry")}
                </Button>
              }
            />
          ) : projects !== null && projects.length === 0 ? (
            <EmptyState title={t("noProject")} note={t("noProjectNote")} />
          ) : (
            <p className="text-body text-ink-3">{t("loading")}</p>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-5 pb-7 pt-6">
              <div className="min-w-0">
                <h1 className="max-w-[16ch] text-display text-ink">{project.name}</h1>
                {/* The description opens the page instead of sitting in a
                    section called "About". As a section it was a serif heading
                    over one line of text, the first of four such blocks, and
                    four blocks built the same way is exactly how a screen ends
                    up with no hierarchy: everything shouted at the same volume,
                    so nothing was findable. Here it does a lead's job - says
                    what this project is before anything says how it is set up -
                    and it is set like every other screen's lead. */}
                <Prose
                  text={project.opis || t("aboutEmpty")}
                  lines={3}
                  className={`measure pt-4 text-body ${
                    project.opis ? "text-ink-2" : "text-ink-3"
                  }`}
                />
              </div>
              {!editing ? (
                <Button variant="secondary" onClick={() => setEditing(true)} className="mt-5">
                  {t("edit")}
                </Button>
              ) : null}
            </div>

            <DuplicateRepoNotice project={project} />

            {editing ? (
              <EditCard
                project={project}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  // The context owns the project row now; refreshing it keeps
                  // the title bar, the switcher and this header in one truth.
                  void refreshProjects();
                  setEditing(false);
                  toast(t("toastSaved"));
                }}
              />
            ) : (
              <ReadView project={project} />
            )}

            {/* The last block of the same document, and the only one that is a
                canvas rather than text, so it gets the width the page just
                gained: at 900 the outer cards were cropped before anyone
                touched them. */}
            <section className="mt-8 border-t border-hairline pt-6">
              <SectionHeader
                title={t("graph")}
                icon={<IconMap />}
                note={t("graphLead")}
              />
              {graphError ? (
                <EmptyState
                  title={t("graphError")}
                  note={t("graphErrorNote")}
                  action={
                    <Button variant="secondary" onClick={() => loadGraph(project.id)}>
                      {t("retry")}
                    </Button>
                  }
                />
              ) : graph === null ? (
                <p className="text-body text-ink-3">{t("loading")}</p>
              ) : graph.nodes.length === 0 ? (
                <EmptyState title={t("graphEmpty")} note={t("graphEmptyNote")} />
              ) : (
                <MemoryGraph nodes={graph.nodes} edges={graph.edges} />
              )}
            </section>
          </>
      )}
    </div>
  );
}

/**
 * One repository address, two archives, and a coder that resolves the address
 * inside whichever archive its token belongs to. It picks one without a word,
 * so half the entries land where the other half cannot see them.
 *
 * The check is a string match: the server normalises repo_ref before storing it,
 * so every copy is already spelled one way. Shown here rather than only at
 * creation because the pair is usually made by two people on two days.
 */
function DuplicateRepoNotice({ project }: { project: Project }) {
  const t = useTranslations("project.duplicate");
  const { sameRepoElsewhere } = useProjectPlacement(project);
  if (!sameRepoElsewhere.length) return null;

  return (
    <div className="mb-5 rounded-control border border-ochre/40 bg-ochre/[0.07] p-5">
      <p className="text-small font-medium text-ink">{t("title")}</p>
      <p className="measure-wide pt-2 text-small text-ink-2">
        {t("body", {
          repo: project.repoRef,
          where: sameRepoElsewhere.map((p) => `${p.name} (${p.workspaceName})`).join(", "),
        })}
      </p>
      <p className="measure-wide pt-2 text-small text-ink-2">{t("fix")}</p>
    </div>
  );
}

// Clip lengths, as classes rather than a computed string: Tailwind reads the
// source to decide what to generate, so the names have to be written out.
const CLAMP = { 3: "line-clamp-3", 6: "line-clamp-6" } as const;

/**
 * The two fields anyone pastes into - the description and the limits - arrive
 * as prose in paragraphs, and pasted prose is what turns this card into a wall.
 * Collapsed, the block shows its opening paragraph clipped to a few lines,
 * which is the part that answers what the project is; the rest is one click.
 *
 * The clip is CSS line-clamp, so nothing measures a box and the count holds at
 * any width. Paragraphs are split on the blank line the server normalises to,
 * and set with their own spacing instead of pre-wrap, where that blank line
 * would have rendered as a full empty row.
 */
function Prose({
  text,
  lines,
  className,
}: {
  text: string;
  lines: keyof typeof CLAMP;
  className: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const paragraphs = text.split("\n\n");

  // ponytail: character count as a stand-in for the rendered height, at roughly
  // 60 characters to a line in this column. A first paragraph just under the
  // clip shows no toggle and needs none; one just over shows a toggle that
  // reveals a line or two. Measure the element if that ever reads as wrong.
  const more = paragraphs.length > 1 || paragraphs[0].length > lines * 60;

  return (
    <div className={className}>
      {(open ? paragraphs : paragraphs.slice(0, 1)).map((paragraph, index) => (
        <p
          key={index}
          // Single newlines are kept: inside a paragraph they are a list or a
          // deliberate break, and the server has already dropped the runs.
          className={`whitespace-pre-line ${index > 0 ? "pt-3" : ""} ${
            !open && more ? CLAMP[lines] : ""
          }`}
        >
          {paragraph}
        </p>
      ))}
      {more ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="pt-3 text-small text-thread underline underline-offset-2"
        >
          {open ? t("showLess") : t("showMore")}
        </button>
      ) : null}
    </div>
  );
}

/** One fact about the project: a mark, the name of the thing, the thing. */
function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-4">
      <span className="pt-[3px] text-ink-3">{icon}</span>
      <div className="min-w-0">
        <dt className="text-label uppercase tracking-[0.12em] text-ink-3">{label}</dt>
        <dd className="min-w-0 break-words pt-1 text-body text-ink">{children}</dd>
      </div>
    </div>
  );
}

function ReadView({ project }: { project: Project }) {
  const t = useTranslations("project");
  const { shared, showWorkspace } = useProjectPlacement(project);
  // Stored as one line of prose; splitting on commas is what makes it scannable
  // without changing how anyone writes it.
  const stack = project.stack
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // Two blocks that differ in kind, where there used to be three that did not.
  //
  // The three were "About", "Technologies" and "Limits": a serif section
  // heading over a line or two of text, three times down the page, each with
  // the same rule above it. Nothing in that arrangement said which of them was
  // worth reading, so the reader got a wall and no way in. The stage and the
  // repository, meanwhile, were dissolved into one grey metadata line under the
  // title where neither could be found on purpose.
  //
  // So: everything that is a short, looked-up value becomes a labelled fact in
  // a two-column list, each with a mark that makes it findable on the second
  // visit. What is left is the one block that is genuinely prose and genuinely
  // matters - the rules the agent reads - and it now has the page to itself.
  return (
    <div>
      <dl className="grid gap-x-8 gap-y-6 border-t border-hairline pt-6 sm:grid-cols-2">
        <Fact icon={<IconStage />} label={t("label.etap")}>
          {t(`etap.${project.etap}`)}
        </Fact>

        <Fact icon={<IconRepo />} label={t("label.repo")}>
          {/* An address a machine resolves, so it is set in the machine voice. */}
          <span className="font-data text-small">{project.repoRef}</span>
        </Fact>

        <Fact icon={<IconStack />} label={t("label.stack")}>
          {stack.length ? (
            // One metadata line, not a row of chips: a stack is a list of names,
            // and eight lozenges made it look like eight things you can click.
            <Meta items={stack} />
          ) : (
            <span className="text-ink-3">{t("techEmpty")}</span>
          )}
        </Fact>

        {/* A reading, not a trophy: how much the archive holds for this
            project, in the same type as every other value in the list. Absent
            rather than zero when the server sent no count, because "empty" and
            "nobody said" are different claims and this is the one screen where
            the first would be believed. */}
        {typeof project.nodeCount === "number" ? (
          <Fact icon={<IconEntries />} label={t("entries")}>
            <span className="tabular">{project.nodeCount}</span>
          </Fact>
        ) : null}

        {/* Only when it could be somebody else's work too, or when there is more
            than one archive to confuse it with. */}
        {shared || showWorkspace ? (
          <Fact icon={<IconTeams />} label={t("archive")}>
            <ProjectPlacement project={project} />
          </Fact>
        ) : null}
      </dl>

      {/* This rule was the thread, on the argument that the block under it is
          the one that steers the agent. On a screen this wide the argument came
          out as a saturated line running the better part of nine hundred
          pixels, which is a large surface in the one colour the system keeps
          for marking a path. The heading, its mark and the words carry the
          weight; the rule goes back to being a rule. */}
      <section className="mt-8 border-t border-hairline pt-6">
        <SectionHeader title={t("limits")} icon={<IconLimits />} note={t("limitsNote")} />
        <Prose
          text={project.ograniczenia || t("limitsEmpty")}
          lines={6}
          className={`measure text-body ${
            project.ograniczenia ? "text-ink-2" : "text-ink-3"
          }`}
        />
      </section>
    </div>
  );
}

function EditCard({
  project,
  onCancel,
  onSaved,
}: {
  project: Project;
  onCancel: () => void;
  onSaved: (updated: Project) => void;
}) {
  const t = useTranslations("project");
  const [draft, setDraft] = useState(project);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Project) => (event: { target: { value: string } }) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  const dirty = (["name", "repoRef", "opis", "stack", "etap", "ograniczenia"] as const).some(
    (key) => draft[key] !== project[key],
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await updateProject(project.id, {
          name: draft.name,
          repoRef: draft.repoRef,
          opis: draft.opis,
          stack: draft.stack,
          etap: draft.etap,
          ograniczenia: draft.ograniczenia,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-5 p-6">
      <Input id="name" label={t("label.name")} value={draft.name} onChange={set("name")} />

      {/* This was read-only, on the grounds that changing it would orphan a
          connected agent. It orphans one either way: the address is how a coder
          finds the archive, so getting it wrong once meant no coder ever found
          this project again, and the only cure on offer was deleting it. The
          backend has always accepted the edit - it normalises the value and has
          a message ready for a collision - so the lock was the frontend's alone.
          A warning is the honest version of that reasoning. */}
      <Input
        id="repo"
        label={t("label.repo")}
        value={draft.repoRef}
        onChange={set("repoRef")}
        note={t("repoWarning")}
      />

      <div>
        <label htmlFor="etap" className="block pb-2 text-small font-medium text-ink">
          {t("label.etap")}
        </label>
        <select
          id="etap"
          value={draft.etap}
          onChange={set("etap")}
          className="h-[44px] w-full rounded-control border border-edge/60 bg-surface px-5 text-body text-ink outline-none focus:border-thread focus:ring-2 focus:ring-thread/25"
        >
          {/* The full sentence here, the one word on the badge above: this is
              where the choice is made and the badge is only read back. */}
          {["prototyp", "produkcja", "utrzymanie"].map((stage) => (
            <option key={stage} value={stage}>
              {t(`etapChoice.${stage}`)}
            </option>
          ))}
        </select>
      </div>

      <Input id="stack" label={t("label.stack")} value={draft.stack} onChange={set("stack")} />
      <Textarea id="opis" label={t("label.opis")} rows={3} value={draft.opis} onChange={set("opis")} />
      <Textarea
        id="limits"
        label={t("label.limits")}
        rows={5}
        value={draft.ograniczenia}
        onChange={set("ograniczenia")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
          {saving ? t("saving") : t("save")}
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={saving}>
          {t("cancel")}
        </Button>
        {error ? <span className="text-small text-iron">{error}</span> : null}
      </div>

      <MoveSection project={project} onMoved={onSaved} />
      <DeleteSection project={project} />
    </Card>
  );
}

/**
 * Sends the project, its entries and its review queue to another archive.
 *
 * Every project made before the create form asked which archive was filed by a
 * default, the oldest membership, so a project meant for a team sits private and
 * the team reads nothing. The other repair is the duplicate: one repository
 * address in two archives makes a coder refuse to open either, and moving one
 * side out is how that gets undone without losing its entries.
 *
 * No typed confirmation, unlike deleting: nothing is lost and the move can be
 * made straight back. The sentence says who stops reading it, which is the part
 * that is not obvious.
 */
function MoveSection({
  project,
  onMoved,
}: {
  project: Project;
  onMoved: (updated: Project) => void;
}) {
  const t = useTranslations("project.move");
  const { workspaces, refreshProjects } = useApp();

  const [target, setTarget] = useState(project.workspaceId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One archive is no choice, and the archive a project is in is only a question
  // once there is a second one to confuse it with.
  if (workspaces.length < 2) return null;

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      const moved = await moveProject(project.id, target);
      await refreshProjects();
      onMoved(moved);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === "unauthorized"
          ? t("ownerOnly")
          : caught instanceof ApiError
            ? caught.message
            : t("failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-hairline pt-5">
      <label htmlFor="move-workspace" className="block pb-2 text-small font-medium text-ink">
        {t("label")}
      </label>
      <select
        id="move-workspace"
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        className="h-[44px] w-full rounded-control border border-edge/60 bg-surface px-5 text-body text-ink outline-none focus:border-thread focus:ring-2 focus:ring-thread/25"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <p className="measure pt-2 text-small text-ink-2">{t("note")}</p>
      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Button
          variant="secondary"
          loading={busy}
          disabled={target === project.workspaceId}
          onClick={() => void move()}
        >
          {busy ? t("moving") : t("move")}
        </Button>
        {error ? <span className="text-small text-iron">{error}</span> : null}
      </div>
    </div>
  );
}

/**
 * Removing a project takes the archive under it: every entry, its anchors, the
 * review queue and the chats. There is no undo and no copy, so the confirmation
 * is the project's own name, typed. A second button to click is a button people
 * click; a name to copy out is a sentence they have to read first.
 *
 * Inside edit mode rather than on the reading screen, and behind a link rather
 * than a standing button, because this is the rarest thing anyone does here.
 */
function DeleteSection({ project }: { project: Project }) {
  const t = useTranslations("project.delete");
  const router = useRouter();
  const { refreshProjects } = useApp();

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteProject(project.id);
      await refreshProjects();
      // Whatever is left becomes the active project, or the empty state does the
      // talking. Either way this screen is about a project that is gone.
      router.push("/home");
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === "unauthorized"
          ? t("ownerOnly")
          : caught instanceof ApiError
            ? caught.message
            : t("failed"),
      );
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="border-t border-hairline pt-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-control text-small text-iron underline underline-offset-2"
        >
          {t("open")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-control border border-iron/40 bg-iron/[0.04] p-5">
      <p className="text-small font-medium text-ink">{t("title")}</p>
      <p className="measure pt-2 text-small text-ink-2">
        {t("warning", { count: String(project.nodeCount ?? 0) })}
      </p>
      <div className="pt-4">
        <Input
          id="confirm-delete"
          label={t("confirmLabel", { name: project.name })}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Button
          variant="destructive"
          loading={busy}
          disabled={typed.trim() !== project.name}
          onClick={() => void remove()}
        >
          {busy ? t("deleting") : t("confirm")}
        </Button>
        <Button
          variant="quiet"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
        >
          {t("cancel")}
        </Button>
        {error ? <span className="text-small text-iron">{error}</span> : null}
      </div>
    </div>
  );
}
