"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { ProjectStep, effectiveRepoRef, type Card as ProjectCard } from "@/components/onboarding-steps";
import { useToast } from "@/components/toast";
import { Banner, Button, Card } from "@/components/ui";
import { ApiError, createProject } from "@/lib/api";

// A second project had nowhere to be made. createProject was called from exactly
// one place in the app, the onboarding wizard, and that wizard turns itself away
// the moment the account owns a project. The switcher listed what existed and
// offered no way to add to it, and the MCP server refuses to invent a project
// from a repo it does not know. So the archive held one project per account, and
// the wall was a coder answering unknown_repo forever.
//
// The form itself is the wizard's third step, reused rather than rewritten: the
// fields, the repository explanation and the file-loading constraints box are
// the same questions whether they are asked on day one or a year in.

export default function NewProjectScreen() {
  const t = useTranslations("project.create");
  const router = useRouter();
  const toast = useToast();
  const { refreshProjects, setActiveProject, workspaces } = useApp();

  const [card, setCard] = useState<ProjectCard>({
    name: "",
    repoRef: "",
    workspaceId: "",
    stack: "",
    etap: "prototyp",
    ograniczenia: "",
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The archives arrive with the provider's first read, which may land after
  // this screen mounts. Filled in once and never again, so a choice already made
  // survives the next refresh of that list.
  useEffect(() => {
    setCard((current) =>
      current.workspaceId || !workspaces.length
        ? current
        : { ...current, workspaceId: workspaces[0].id },
    );
  }, [workspaces]);

  const submit = async () => {
    setFailure(null);
    setFieldError(null);
    if (!card.name.trim()) {
      setFieldError(t("error.name"));
      return;
    }
    setBusy(true);
    try {
      const created = await createProject({
        name: card.name.trim(),
        repoRef: effectiveRepoRef(card),
        // Empty until the archives are read, and empty is the server's own
        // default, so a fast submit files it exactly where it would have gone.
        workspaceId: card.workspaceId || undefined,
        stack: card.stack.trim(),
        etap: card.etap,
        ograniczenia: card.ograniczenia.trim(),
      });
      await refreshProjects();
      // Opened as the active one: nobody fills this in to then go looking for it
      // in a menu, and the coder is about to be pointed at it.
      setActiveProject(created.id);
      toast(t("created"));
      router.push("/project");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "validation") {
        setFieldError(
          /repo_ref/.test(caught.message) ? t("error.repoTaken") : caught.message,
        );
      } else {
        setFailure(caught instanceof ApiError ? caught.message : t("error.failed"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[860px] pt-6">
      {failure ? <Banner variant="notice" what={failure} /> : null}

      <Card as="section" className="p-6">
        <ProjectStep
          card={card}
          error={fieldError}
          heading={t("title")}
          onChange={(patch) => setCard({ ...card, ...patch })}
          workspaces={workspaces}
        />
      </Card>

      <div className="flex items-center gap-4 py-7">
        <Button onClick={() => void submit()} loading={busy}>
          {busy ? t("creating") : t("create")}
        </Button>
        <Button variant="quiet" onClick={() => router.back()} disabled={busy}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
