"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
/**
 * Whether the backend answers. Read by the main screen, which turns "down" into
 * a banner over stale data; nothing else needs to know, and nothing shows the
 * other two states.
 */
export type ServerState = "checking" | "up" | "down";
import {
  ApiError,
  getPending,
  listProjects,
  readToken,
  type PendingAction,
  type Project,
  type ReviewNode,
} from "@/lib/api";

// One owner for the data every screen shares: the project list, the active
// project, the review queue and whether the server answers. Lives in the
// (shell) layout, so it survives navigation; screens read it instead of
// refetching the world on every mount.

export const ACTIVE_PROJECT_KEY = "ariadne.activeProject";

export type PendingFeed = {
  pendingActions: PendingAction[];
  nodesToReview: ReviewNode[];
};

type AppContextValue = {
  projects: Project[] | null;
  activeProject: Project | null;
  setActiveProject: (id: string) => void;
  refreshProjects: () => Promise<void>;
  pendingFeed: PendingFeed | null;
  pendingCount: number;
  refreshPending: () => Promise<void>;
  server: ServerState;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp outside <AppProvider>");
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingFeed, setPendingFeed] = useState<PendingFeed | null>(null);
  const [server, setServer] = useState<ServerState>("checking");

  const refreshProjects = useCallback(async () => {
    try {
      const rows = await listProjects();
      setServer("up");
      setProjects(rows);
      const remembered = localStorage.getItem(ACTIVE_PROJECT_KEY);
      const resolved = rows.some((p) => p.id === remembered)
        ? remembered
        : (rows[0]?.id ?? null);
      // Persisting the fallback is the fix for the eternal "loading" on
      // single-project accounts: nothing else ever wrote this key for them.
      if (resolved && resolved !== remembered) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, resolved);
      }
      setActiveId(resolved);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        // request() already dropped the token.
        router.replace("/");
        return;
      }
      // Whatever is already on screen beats blanking into "no projects".
      setServer(
        caught instanceof ApiError && caught.failure === "unreachable" ? "down" : "up",
      );
    }
  }, [router]);

  const refreshPending = useCallback(async () => {
    try {
      setPendingFeed(await getPending());
    } catch {
      // The badge keeps its last value; screens show their own errors.
    }
  }, []);

  useEffect(() => {
    if (!readToken()) {
      router.replace("/");
      return;
    }
    void refreshProjects();
    void refreshPending();
  }, [refreshProjects, refreshPending, router]);

  const setActiveProject = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    setActiveId(id);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      projects,
      activeProject: projects?.find((p) => p.id === activeId) ?? null,
      setActiveProject,
      refreshProjects,
      pendingFeed,
      pendingCount: pendingFeed
        ? pendingFeed.pendingActions.length + pendingFeed.nodesToReview.length
        : 0,
      refreshPending,
      server,
    }),
    [projects, activeId, setActiveProject, refreshProjects, pendingFeed, refreshPending, server],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
