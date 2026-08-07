"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { TitleBar, type ServerState } from "@/components/title-bar";
import { clearToken, getPending, listProjects, readToken, type Project } from "@/lib/api";

// The frame every screen inside the app sits in: title bar, a column on the
// left, content on the right.
//
// The column answers "where am I" and "which project is this about" at all
// times. Those were the two questions the old build left open: the project was
// a bare select that looked like any other form field, and the current screen
// was marked by a 2px line you had to look for.

const ACTIVE_PROJECT_KEY = "ariadne.activeProject";

export type Section = "home" | "project" | "assistant" | "database" | "pending";

const LINKS: { section: Section; href: string; needsProject: boolean; icon: ReactNode }[] = [
  { section: "home", href: "/home", needsProject: false, icon: <IconHome /> },
  { section: "project", href: "/project", needsProject: true, icon: <IconProject /> },
  { section: "assistant", href: "/assistant", needsProject: true, icon: <IconAsk /> },
  { section: "database", href: "/database", needsProject: true, icon: <IconAdd /> },
  { section: "pending", href: "/pending", needsProject: false, icon: <IconQueue /> },
];

/** Read by every screen that needs to know which project it is showing. */
export function readActiveProject(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

/**
 * Switch project from anywhere. The reload is deliberate: every screen reads
 * the active project once on mount, and this is the single event that
 * invalidates all of them at once, including the title bar and the column.
 */
export function pickProject(id: string) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  window.location.reload();
}

const QUEUE_CHANGED = "ariadne:queue-changed";

/**
 * Tell the column its counter is stale. Called by the review screen after it
 * settles something: without it the column kept saying 6 while the page below
 * said 5, and a number that disagrees with the list under it is worse than no
 * number. A DOM event rather than a store, because there is exactly one
 * listener and it is not on this screen's React tree.
 */
export function queueChanged() {
  window.dispatchEvent(new Event(QUEUE_CHANGED));
}

export function AppShell({
  children,
  server = "up",
  banner,
}: {
  children: ReactNode;
  server?: ServerState;
  banner?: ReactNode;
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if (!readToken()) {
      router.replace("/");
      return;
    }
    void listProjects()
      .then((rows) => {
        setProjects(rows);
        const remembered = readActiveProject();
        setActiveId(rows.some((p) => p.id === remembered) ? remembered : (rows[0]?.id ?? null));
      })
      .catch(() => {});
  }, [router]);

  // The counter is the one number on screen that is about the whole account
  // rather than the open project, so it is fetched here and not per screen. It
  // refetches whenever the review screen settles something.
  useEffect(() => {
    const count = () =>
      void getPending()
        .then((feed) => setWaiting(feed.pendingActions.length + feed.nodesToReview.length))
        .catch(() => {});
    count();
    window.addEventListener(QUEUE_CHANGED, count);
    return () => window.removeEventListener(QUEUE_CHANGED, count);
  }, []);

  const active = projects.find((p) => p.id === activeId) ?? null;

  const signOut = () => {
    clearToken();
    // Not router.push: the token is gone and nothing behind this point should
    // stay mounted holding data fetched with it.
    window.location.href = "/";
  };

  return (
    <div className="flex h-full flex-col">
      <TitleBar project={active?.name} server={server} />
      {banner}

      <div className="flex min-h-0 flex-1">
        {/* Icons only below 1024px, which covers the 880px window minimum, and
            labelled above it. The window opens at 1100px, so the labelled form
            is what anyone actually sees. */}
        <nav className="flex w-[68px] shrink-0 flex-col gap-2 border-r border-hairline bg-plaster-sunk/60 p-3 lg:w-[236px] lg:p-4">
          <ProjectSwitcher projects={projects} active={active} />

          <ul className="flex flex-col gap-1 pt-2">
            {LINKS.map(({ section, href, needsProject, icon }) => {
              const blocked = needsProject && !activeId;
              const current = pathname === href;
              const shared =
                "flex items-center gap-3 rounded-control px-4 py-[10px] text-small transition-colors duration-state";

              if (blocked) {
                // Present but not clickable, and it says why on hover rather
                // than vanishing: a menu that changes length as you use the app
                // is harder to learn than one with a dimmed row.
                return (
                  <li key={section}>
                    <span
                      title={t("needsProject")}
                      aria-disabled="true"
                      className={`${shared} cursor-not-allowed text-ink-3/50`}
                    >
                      <span className="shrink-0">{icon}</span>
                      <span className="hidden lg:inline">{t(section)}</span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={section}>
                  <Link
                    href={href}
                    title={t(section)}
                    aria-current={current ? "page" : undefined}
                    className={`${shared} ${
                      current
                        ? "bg-surface font-medium text-ink shadow-card"
                        : "text-ink-2 hover:bg-surface/70 hover:text-ink"
                    }`}
                  >
                    <span className={`shrink-0 ${current ? "text-blue" : ""}`}>{icon}</span>
                    <span className="hidden lg:inline">{t(section)}</span>
                    {section === "pending" && waiting ? (
                      <span className="ml-auto hidden rounded-pill bg-ochre/15 px-[8px] py-[2px] font-data text-data tabular text-ochre lg:inline">
                        {waiting}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={signOut}
            title={t("signOut")}
            className="mt-auto flex items-center gap-3 rounded-control px-4 py-[10px] text-small text-ink-3 transition-colors duration-state hover:bg-surface/70 hover:text-iron"
          >
            <IconSignOut />
            <span className="hidden lg:inline">{t("signOut")}</span>
          </button>
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

// A real switcher, not a form field: the open project is named in full with its
// stage underneath, and the list only appears when asked for. Built on <details>
// so that closing on Escape and on outside click come from the browser.
function ProjectSwitcher({ projects, active }: { projects: Project[]; active: Project | null }) {
  const t = useTranslations("nav");
  const tProject = useTranslations("project");

  if (!active) {
    return (
      <div className="hidden rounded-control border border-dashed border-edge/40 px-4 py-[10px] text-small text-ink-3 lg:block">
        {t("noProject")}
      </div>
    );
  }

  // One project is not a choice, so it reads as a heading instead of a control.
  if (projects.length < 2) {
    return (
      <div className="rounded-control px-4 py-3 lg:bg-surface lg:shadow-card">
        <p className="truncate text-small font-medium text-ink max-lg:hidden">{active.name}</p>
        <p className="truncate font-data text-data text-ink-3 max-lg:hidden">
          {tProject(`etap.${active.etap}`)}
        </p>
        <p className="grid h-[34px] w-full place-items-center rounded-control bg-surface font-data text-data font-medium text-blue lg:hidden">
          {active.name.slice(0, 2).toUpperCase()}
        </p>
      </div>
    );
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-control px-4 py-3 marker:hidden lg:bg-surface lg:shadow-card">
        <span className="min-w-0 flex-1 max-lg:hidden">
          <span className="block truncate text-left text-small font-medium text-ink">
            {active.name}
          </span>
          <span className="block truncate text-left font-data text-data text-ink-3">
            {tProject(`etap.${active.etap}`)}
          </span>
        </span>
        <span className="grid h-[34px] w-full place-items-center rounded-control bg-surface font-data text-data font-medium text-blue lg:hidden">
          {active.name.slice(0, 2).toUpperCase()}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-ink-3 transition-transform duration-state group-open:rotate-180 max-lg:hidden"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </summary>

      <ul className="absolute left-0 right-0 z-20 mt-1 max-h-[320px] overflow-y-auto rounded-card border border-hairline bg-surface p-1 shadow-lifted max-lg:left-3 max-lg:w-[220px]">
        {projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              onClick={() => pickProject(project.id)}
              className={`flex w-full items-baseline justify-between gap-3 rounded-control px-4 py-3 text-left text-small transition-colors duration-state hover:bg-plaster-sunk ${
                project.id === active.id ? "text-ink" : "text-ink-2"
              }`}
            >
              <span className="min-w-0 truncate">{project.name}</span>
              {project.pendingCount ? (
                <span className="shrink-0 font-data text-data tabular text-ochre">
                  {project.pendingCount}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Line icons at 18px, one weight, no fills. They exist to make the column
// scannable at the narrow width where the labels are gone, not for decoration.
const stroke = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconHome() {
  return (
    <svg {...stroke}>
      <path d="M2.5 7.2 9 2.5l6.5 4.7V15a.5.5 0 0 1-.5.5h-4v-5H7v5H3a.5.5 0 0 1-.5-.5Z" />
    </svg>
  );
}

function IconProject() {
  return (
    <svg {...stroke}>
      <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
      <path d="M2.5 7h13M6 3.5v3.5" />
    </svg>
  );
}

function IconAsk() {
  return (
    <svg {...stroke}>
      <path d="M15.5 9c0 3.1-2.9 5.6-6.5 5.6-.8 0-1.6-.1-2.3-.4L2.5 15.5l1.3-3.4A5.3 5.3 0 0 1 2.5 9C2.5 5.9 5.4 3.4 9 3.4s6.5 2.5 6.5 5.6Z" />
    </svg>
  );
}

function IconAdd() {
  return (
    <svg {...stroke}>
      <path d="M9 3.5v11M3.5 9h11" />
    </svg>
  );
}

function IconQueue() {
  return (
    <svg {...stroke}>
      <path d="M3 5h12M3 9h12M3 13h7" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg {...stroke}>
      <path d="M11 12.5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M7.5 9h8m0 0-2.5-2.5M15.5 9 13 11.5" />
    </svg>
  );
}
