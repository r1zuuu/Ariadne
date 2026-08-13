"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { MemoryGraph } from "@/components/memory-graph";
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
  deleteProject,
  getGraph,
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
    <div className="mx-auto max-w-[900px]">
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
            <div className="flex flex-wrap items-end justify-between gap-5 pb-8 pt-6">
              <div className="min-w-0">
                <h1 className="max-w-[14ch] text-display text-ink">{project.name}</h1>
                {/* Stage and repository are both facts about the project, so
                    they are one metadata line rather than a tinted label beside
                    the name competing with it. */}
                <div className="pt-3">
                  <Meta items={[t(`etap.${project.etap}`), project.repoRef]} />
                </div>
              </div>
              {!editing ? (
                <Button variant="secondary" onClick={() => setEditing(true)} className="mb-2">
                  {t("edit")}
                </Button>
              ) : null}
            </div>


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

            <section className="pt-8">
              <SectionHeader title={t("graph")} />
              <p className="pb-4 text-small text-ink-2">{t("graphLead")}</p>
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

function ReadView({ project }: { project: Project }) {
  const t = useTranslations("project");
  // Stored as one line of prose; splitting on commas is what makes it scannable
  // without changing how anyone writes it.
  const stack = project.stack
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-6">
        <h2 className="pb-2 text-section text-ink">{t("about")}</h2>
        <p className={`text-body leading-8 ${project.opis ? "text-ink-2" : "text-ink-3"}`}>
          {project.opis || t("aboutEmpty")}
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="pb-3 text-section text-ink">{t("tech")}</h2>
        {stack.length ? (
          // One metadata line, not a row of chips: a stack is a list of names,
          // and eight lozenges made it look like eight things you can click.
          <Meta items={stack} />
        ) : (
          <p className="text-body text-ink-3">{t("techEmpty")}</p>
        )}
      </Card>

      {/* Set apart with the thread colour, because this is the section that
          steers the agent: everything else describes the project, this one
          constrains what may be done to it. */}
      <Card className="border-thread/25 p-6">
        <h2 className="text-section text-ink">{t("limits")}</h2>
        <p className="pb-3 pt-1 text-small text-ink-3">{t("limitsNote")}</p>
        <p
          className={`whitespace-pre-wrap text-body leading-8 ${
            project.ograniczenia ? "text-ink-2" : "text-ink-3"
          }`}
        >
          {project.ograniczenia || t("limitsEmpty")}
        </p>
      </Card>
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
          className="h-[44px] w-full rounded-control border border-edge/60 bg-surface px-5 text-body text-ink outline-none focus:border-thread focus:ring-2 focus:ring-thread/15"
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

      <DeleteSection project={project} />
    </Card>
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
      <p className="max-w-[64ch] pt-2 text-small text-ink-2">
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
