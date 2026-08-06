import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Global Admin/User mode switch. "user" = presentation/view-only (default).
 * "admin" = full editing access everywhere.
 *
 * There is no login UI. Admin mode is toggled with the keyboard shortcut
 * Ctrl+Shift+1 (Cmd+Shift+1 on Mac), which flips between "user" and "admin".
 * The current mode persists in localStorage.
 */
type AppMode = "user" | "admin";

interface AppModeContextValue {
  mode: AppMode;
  isAdmin: boolean;
  /** Switch modes directly (still available for any in-app controls). */
  setMode: (m: AppMode) => void;
  /** Flip between user and admin mode. */
  toggleAdmin: () => void;
  signOut: () => void;
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

  const persist = (m: AppMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* noop */
    }
  };

  const setMode = (m: AppMode) => persist(m);
  const toggleAdmin = () => persist(mode === "admin" ? "user" : "admin");

  // Keyboard shortcut: Ctrl+Shift+1 (or Cmd+Shift+1 on Mac) toggles admin mode.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const combo = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "1" || e.code === "Digit1");
      if (!combo) return;
      e.preventDefault();
      setModeState((prev) => {
        const next: AppMode = prev === "admin" ? "user" : "admin";
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* noop */
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <AppModeContext.Provider
      value={{
        mode,
        isAdmin: mode === "admin",
        setMode,
        toggleAdmin,
        signOut: () => persist("user"),
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used inside <AppModeProvider>");
  return ctx;
}
