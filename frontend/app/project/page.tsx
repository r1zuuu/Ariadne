"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AppShell, readActiveProject } from "@/components/app-shell";
import { NodeGraph } from "@/components/node-graph";
import { Button, Field } from "@/components/ui";
import {
  getGraph,
  listProjects,
  updateProject,
  type GraphEdge,
  type Node,
  type Project,
} from "@/lib/api";

// Screen 04. The project card, editable, and the graph of its entries.
//
// The card is edited in place rather than behind a modal: it is the one piece
// of text in the product a person writes about their own project, and putting
// it behind a button made it feel like configuration.

export default function ProjectScreen() {
  const t = useTranslations("project");

  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Partial<Project>>({});
  const [graph, setGraph] = useState<{ nodes: Node[]; edges: GraphEdge[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = readActiveProject();
    if (!id) return;
    void listProjects()
      .then((rows) => {
        const found = rows.find((p) => p.id === id) ?? null;
        setProject(found);
        if (found) setDraft(found);
      })
      .catch(() => {});
    void getGraph(id)
      .then(setGraph)
      .catch(() => setGraph({ nodes: [], edges: [] }));
  }, []);

  const dirty =
    project !== null &&
    (["name", "opis", "stack", "etap", "ograniczenia"] as const).some(
      (key) => (draft[key] ?? "") !== (project[key] ?? ""),
    );

  const save = async () => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProject(project.id, {
        name: draft.name,
        opis: draft.opis,
        stack: draft.stack,
        etap: draft.etap,
        ograniczenia: draft.ograniczenia,
      });
      setProject(updated);
      setDraft(updated);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof Project) => (event: { target: { value: string } }) => {
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));
    setSaved(false);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-section">{project?.name ?? t("title")}</h1>

        {project === null ? (
          <p className="pt-6 text-body text-ink-3">{t("loading")}</p>
        ) : (
          <>
            <section className="pt-6">
              <div className="divide-y divide-hairline border-y border-hairline">
                <Field id="name" label={t("label.name")} value={draft.name ?? ""} onChange={set("name")} />
                <Field
                  id="repo"
                  label={t("label.repo")}
                  value={project.repoRef}
                  readOnly
                  // The repo ref is the key a coder's MCP calls resolve against,
                  // so changing it here would silently orphan a connected agent.
                  note={t("repoFixed")}
                />
                <Field id="stack" label={t("label.stack")} value={draft.stack ?? ""} onChange={set("stack")} />
                <Field id="etap" label={t("label.etap")}>
                  <select
                    id="etap"
                    value={draft.etap ?? "prototyp"}
                    onChange={set("etap")}
                    className="w-full rounded-control border border-edge bg-plaster-raised px-4 py-3 text-body text-ink"
                  >
                    {["prototyp", "produkcja", "utrzymanie"].map((stage) => (
                      <option key={stage} value={stage}>
                        {t(`etap.${stage}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="opis" label={t("label.opis")}>
                  <textarea
                    id="opis"
                    rows={3}
                    value={draft.opis ?? ""}
                    onChange={set("opis")}
                    className="w-full rounded-control border border-edge bg-plaster-raised px-4 py-3 text-body text-ink outline-none"
                  />
                </Field>
                <Field id="limits" label={t("label.limits")}>
                  <textarea
                    id="limits"
                    rows={3}
                    value={draft.ograniczenia ?? ""}
                    onChange={set("ograniczenia")}
                    className="w-full rounded-control border border-edge bg-plaster-raised px-4 py-3 text-body text-ink outline-none"
                  />
                </Field>
              </div>

              <div className="flex items-center gap-5 pt-5">
                <Button onClick={() => void save()} disabled={!dirty || saving}>
                  {saving ? t("saving") : t("save")}
                </Button>
                {saved ? <span className="text-small text-ink-2">{t("saved")}</span> : null}
                {error ? <span className="text-small text-iron">{error}</span> : null}
              </div>
            </section>

            <section className="pt-9">
              <h2 className="text-lead">{t("graph")}</h2>
              {graph === null ? (
                <p className="pt-4 text-body text-ink-3">{t("loading")}</p>
              ) : graph.nodes.length === 0 ? (
                <p className="max-w-[68ch] pt-4 text-body text-ink-2">{t("graphEmpty")}</p>
              ) : (
                <div className="pt-5">
                  <NodeGraph nodes={graph.nodes} edges={graph.edges} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
