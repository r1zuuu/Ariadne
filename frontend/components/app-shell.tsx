"use client";

import { AnimatePresence, m } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/components/app-provider";
import { MemberMarks, useProjectPlacement } from "@/components/project-marks";
import { enterTransition } from "@/components/motion";
import { TitleBar } from "@/components/title-bar";
import {
  IconAdd,
  IconHome,
  IconProject,
  IconQueue,
  IconSettings,
  IconSignOut,
  IconTasks,
  IconTeams,
  IconToken,
} from "@/components/icons";
import { clearToken, type Project } from "@/lib/api";

// The frame every screen inside the app sits in: title bar, a column on the
// left, content on the right.
//
// The column answers "where am I" and "which project is this about" at all
// times. Data comes from AppProvider in the (shell) layout, so navigating
// between screens neither refetches it nor remounts this frame.

export type Section =
  | "home"
  | "project"
  | "tasks"
  | "database"
  | "pending"
  | "teams"
  | "agents"
  | "settings";

// `label` is not always the section name: "database" is what the screen has
// always been called in the code and the URL, but "Dodaj kontekst" told a
// non-technical reader nothing, so the column says "Dodaj do pamięci" instead.
type NavLink = {
  section: Section;
  label: string;
  href: string;
  needsProject: boolean;
  icon: ReactNode;
};

// Two groups, because the column mixes two kinds of place: where the work on
// this project happens, and where the account is looked after. Six equal rows
// answered "which screens exist", not "where should I go".
const WORK_LINKS: NavLink[] = [
  { section: "home", label: "home", href: "/home", needsProject: false, icon: <IconHome /> },
  {
    section: "project",
    label: "project",
    href: "/project",
    needsProject: true,
    icon: <IconProject />,
  },
  {
    section: "tasks",
    label: "tasks",
    href: "/tasks",
    needsProject: true,
    icon: <IconTasks />,
  },
  {
    section: "database",
    label: "memory",
    href: "/database",
    needsProject: true,
    icon: <IconAdd />,
  },
];

const ACCOUNT_LINKS: NavLink[] = [
  {
    section: "pending",
    label: "pending",
    href: "/pending",
    needsProject: false,
    icon: <IconQueue />,
  },
  {
    section: "teams",
    label: "teams",
    href: "/teams",
    needsProject: false,
    icon: <IconTeams />,
  },
  {
    section: "agents",
    label: "agents",
    href: "/agents",
    needsProject: false,
    icon: <IconToken />,
  },
  {
    section: "settings",
    label: "settings",
    href: "/settings",
    needsProject: false,
    icon: <IconSettings />,
  },
];

/** Whether the navigation column keeps its place. "0" means someone put it away. */
const NAV_PINNED_KEY = "ariadne.nav";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const { projects, activeProject, pendingCount, invitations } = useApp();

  const active = activeProject;
  const counts = { pending: pendingCount, teams: invitations.length };

  // Two ways for the column to be there, and they behave differently on
  // purpose. Pinned, it is part of the row and the page sits beside it, which
  // is what an application's navigation normally does. Reached for with the
  // pointer, it floats over the page and nothing moves sideways.
  //
  // It used to start away and unpin itself again on every navigation, so there
  // was no way to keep it: you pinned it, clicked a link, and it was gone. On a
  // new account there was nothing on screen saying navigation existed at all -
  // one unlabelled icon in the title bar and a strip of edge to discover by
  // accident. It starts pinned now and remembers being unpinned, so anyone who
  // wants the bare screen says so once.
  const [navPinned, setNavPinned] = useState(true);
  const [navNear, setNavNear] = useState(false);
  const navShown = navPinned || navNear;

  // Read after mount, not in the initialiser: these screens are prerendered
  // where localStorage does not exist.
  useEffect(() => {
    setNavPinned(localStorage.getItem(NAV_PINNED_KEY) !== "0");
  }, []);

  const toggleNav = () => {
    const next = !navPinned;
    setNavPinned(next);
    localStorage.setItem(NAV_PINNED_KEY, next ? "1" : "0");
  };

  const signOut = () => {
    clearToken();
    // Not router.push: the token is gone and nothing behind this point should
    // stay mounted holding data fetched with it.
    window.location.href = "/";
  };

  return (
    <div className="flex h-full flex-col">
      <TitleBar navOpen={navPinned} onToggleNav={toggleNav} />

      <div
        className="relative flex min-h-0 flex-1"
        // The pointer's distance from the left edge decides it, rather than an
        // invisible strip: a strip three quarters of a column wide would sit
        // over the page swallowing clicks meant for what is under it. Three
        // quarters to call it in, its full width to keep it, so it neither
        // needs the very edge nor closes under the pointer.
        onMouseMove={(event) => {
          const width = window.innerWidth >= 1024 ? 236 : 68;
          setNavNear((was) => event.clientX < (was ? width : width * 0.75));
        }}
        // A pointer that leaves through any other edge stops sending moves, and
        // the column would stay out.
        onMouseLeave={() => setNavNear(false)}
      >
        {/* Icons only below 1024px, which covers the 880px window minimum, and
            labelled above it. The window opens at 1100px, so the labelled form
            is what anyone actually sees.

            It comes in from off the left edge on the enter curve: the same
            200ms every other arrival in the app takes, and the ease that ends
            slowly, so the column settles rather than stops. Reduced motion is
            handled by MotionConfig above it - the transform drops and the
            column is simply there. */}
        <AnimatePresence initial={false}>
          {navShown ? (
            <m.nav
              initial={navPinned ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={enterTransition}
              // Pinned it holds a place in the row, so the page is beside it
              // rather than under it. Only the reached-for form floats, and only
              // that one casts a shadow, because only that one is above
              // something.
              className={`flex w-[68px] shrink-0 flex-col gap-2 border-r border-hairline bg-plaster-sunk p-3 lg:w-[236px] lg:p-4 ${
                navPinned ? "relative" : "absolute inset-y-0 left-0 z-30 shadow-lifted"
              }`}
            >
              <ProjectSwitcher projects={projects ?? []} active={active} />

              <NavList
                links={WORK_LINKS}
                pathname={pathname}
                hasProject={!!active}
                counts={counts}
                className="pt-2"
              />

              {/* The account group sits under its own hairline: the queue and the
                  settings are about the whole archive, not the open project. */}
              <NavList
                links={ACCOUNT_LINKS}
                pathname={pathname}
                hasProject={!!active}
                counts={counts}
                className="mt-2 border-t border-hairline pt-3"
              />

              <button
                type="button"
                onClick={signOut}
                title={t("signOut")}
                className="mt-auto flex items-center gap-3 rounded-control px-4 py-[10px] text-small text-ink-3 transition-colors duration-state hover:bg-surface/70 hover:text-iron"
              >
                <IconSignOut />
                <span className="hidden lg:inline">{t("signOut")}</span>
              </button>
            </m.nav>
          ) : null}
        </AnimatePresence>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavList({
  links,
  pathname,
  hasProject,
  counts,
  className = "",
}: {
  links: NavLink[];
  pathname: string;
  hasProject: boolean;
  /** Keyed by section, because two entries carry one now: things to approve and
   *  people waiting on an answer. */
  counts: Record<string, number>;
  className?: string;
}) {
  const t = useTranslations("nav");

  return (
    <ul className={`flex flex-col gap-1 ${className}`}>
      {links.map(({ section, label, href, needsProject, icon }) => {
        const blocked = needsProject && !hasProject;
        const current = pathname === href;
        const shared =
          "flex items-center gap-3 rounded-control px-4 py-[10px] text-small transition-colors duration-state";

        if (blocked) {
          // Present but not clickable, and it says why on hover rather than
          // vanishing: a menu that changes length as you use the app is harder
          // to learn than one with a dimmed row.
          return (
            <li key={section}>
              <span
                title={t("needsProject")}
                aria-disabled="true"
                className={`${shared} cursor-not-allowed text-ink-3/50`}
              >
                <span className="shrink-0">{icon}</span>
                <span className="hidden lg:inline">{t(label)}</span>
              </span>
            </li>
          );
        }

        return (
          <li key={section}>
            <Link
              href={href}
              title={t(label)}
              aria-current={current ? "page" : undefined}
              className={`relative ${shared} ${
                current ? "font-medium text-ink" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
              }`}
            >
              {/* One marker for the whole column, so moving between screens
                  slides it instead of blinking it out here and in there. The
                  taut edge on its left is the thread marking where you stand;
                  it is the only saturated colour in the frame. Behind the row
                  rather than around it, because the label must not move. */}
              {current ? (
                <m.span
                  layoutId="nav-marker"
                  transition={enterTransition}
                  aria-hidden="true"
                  className="absolute inset-0 overflow-hidden rounded-control bg-surface shadow-card"
                >
                  <span className="absolute bottom-[6px] left-0 top-[6px] w-[2px] bg-thread" />
                </m.span>
              ) : null}
              <span className="relative shrink-0">{icon}</span>
              <span className="relative hidden lg:inline">{t(label)}</span>
              {counts[section] ? (
                <span className="relative ml-auto hidden rounded-label bg-ochre/15 px-[8px] py-[2px] text-data tabular text-ochre lg:inline">
                  {counts[section]}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// A real switcher, not a form field: the open project is named in full with its
// stage underneath, and the list only appears when asked for. Built on <details>
// so that closing on Escape and on outside click come from the browser.
function ProjectSwitcher({ projects, active }: { projects: Project[]; active: Project | null }) {
  const t = useTranslations("nav");
  const tProject = useTranslations("project");
  const { setActiveProject, workspaces } = useApp();
  const placement = useProjectPlacement(active);

  if (!active) {
    return (
      <div className="hidden rounded-control border border-dashed border-edge/40 px-4 py-[10px] text-small text-ink-3 lg:block">
        {t("noProject")}
      </div>
    );
  }

  // This used to read as a plain heading below two projects, on the grounds that
  // one project is not a choice. It is a control now regardless of the count,
  // because the list is also the only way to reach a second project: creating
  // one lived in the onboarding wizard, which turns away every account that
  // already has one, so an archive could never hold more than a single project.

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-control px-4 py-3 marker:hidden lg:bg-surface lg:shadow-card">
        <span className="min-w-0 flex-1 max-lg:hidden">
          <span className="block truncate text-left text-small font-medium text-ink">
            {active.name}
          </span>
          {/* The stage used to be alone here. Which archive the project sits in
              matters more the moment there are two of them, and whether anyone
              else can read it matters always. */}
          <span className="flex items-center gap-2 truncate text-left text-data text-ink-3">
            {tProject(`etap.${active.etap}`)}
            {placement.workspace && (placement.shared || placement.showWorkspace) ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="truncate">{placement.workspace.name}</span>
                {placement.shared ? <MemberMarks emails={placement.members} max={2} /> : null}
              </>
            ) : null}
          </span>
        </span>
        <span className="grid h-[34px] w-full place-items-center rounded-control bg-surface text-data font-medium text-thread lg:hidden">
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
              onClick={(event) => {
                setActiveProject(project.id);
                // <details> only closes itself on outside click; picking a
                // project is a decision, so the list folds away with it.
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className={`flex w-full items-baseline justify-between gap-3 rounded-control px-4 py-3 text-left text-small transition-colors duration-state hover:bg-surface-2 ${
                project.id === active.id ? "text-ink" : "text-ink-2"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{project.name}</span>
                {/* Two projects can carry the same name in two archives, and one
                    repository can sit in both. Without the archive named here
                    the list offers a choice between two identical rows. */}
                {workspaces.length > 1 ? (
                  <span className="block truncate pt-0.5 text-data text-ink-3">
                    {project.workspaceName}
                  </span>
                ) : null}
              </span>
              {project.pendingCount ? (
                <span className="shrink-0 text-data tabular text-ochre">
                  {project.pendingCount}
                </span>
              ) : null}
            </button>
          </li>
        ))}
        <li className="mt-1 border-t border-hairline pt-1">
          <Link
            href="/project/new"
            onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
            className="flex w-full items-center gap-3 rounded-control px-4 py-3 text-left text-small text-thread transition-colors duration-state hover:bg-surface-2"
          >
            <IconAdd />
            {t("newProject")}
          </Link>
        </li>
      </ul>
    </details>
  );
}
