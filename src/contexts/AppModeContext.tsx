import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Global Admin/User mode switch. "user" = presentation/view-only (default —
 * what the department page in the screenshot shows: no EDIT TOPOLOGY button,
 * 3D View is orbit/zoom only). "admin" = full editing access everywhere.
 *
 * Deliberately NOT real access control — no login, no server check. It's a
 * client-side UI toggle only. If real security is ever needed later, this
 * is the single place to swap in an actual auth check.
 */
type AppMode = "user" | "admin";

interface AppModeContextValue {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  isAdmin: boolean;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

const STORAGE_KEY = "nia-app-mode";

function loadInitialMode(): AppMode {
  if (typeof window === "undefined") return "user";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "admin" ? "admin" : "user";
  } catch {
    return "user";
  }
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(loadInitialMode);

  const setMode = (m: AppMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* noop */
    }
  };

  return (
    <AppModeContext.Provider value={{ mode, setMode, isAdmin: mode === "admin" }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used inside <AppModeProvider>");
  return ctx;
}