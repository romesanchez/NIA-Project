import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ALL_DEPARTMENTS, GROUPS } from "@/data/departments";
import { useAppMode } from "@/contexts/AppModeContext";
import niaLogo from "@/assets/nia-logo.png";

interface Props {
  activeIndex: number;
  onJump: (i: number) => void;
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

const GROUP_COLORS: Record<string, string> = {
  ro1: "bg-emerald-600",
  eod: "bg-blue-600",
  rtc: "bg-violet-600",
};

const GROUP_DOT: Record<string, string> = {
  ro1: "bg-emerald-500",
  eod: "bg-blue-500",
  rtc: "bg-violet-500",
};

type Dept = (typeof ALL_DEPARTMENTS)[number];

// A single group pill + its dropdown menu. The dropdown is rendered through
// a React portal straight into document.body instead of as a normal DOM
// child, because the nav it sits in has `overflow-x-auto` for horizontal
// scrolling on small screens — and per the CSS spec, setting overflow-x to
// anything but `visible` forces overflow-y to clip too, even though it's
// never set explicitly. That was silently clipping the dropdown away
// (nothing appeared), regardless of z-index. A portal sidesteps that
// entirely: the menu is positioned with `position: fixed` using the
// button's real on-screen coordinates, so no ancestor's overflow can touch
// it.
function GroupNavItem({
  group, groupDepts, hasActive, isOpen, dotClass, pillClass,
  onEnter, onToggle, activeIndex, onSelect,
}: {
  group: { id: string; label: string };
  groupDepts: Dept[];
  hasActive: boolean;
  isOpen: boolean;
  dotClass: string;
  pillClass: string;
  onEnter: () => void;
  onToggle: () => void;
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const recompute = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left });
  };

  useEffect(() => {
    if (!isOpen) return;
    recompute();
    // Recompute on resize/scroll (capture=true so it also catches the nav's
    // own horizontal scroll, since that's a scroll on an ancestor element).
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onMouseEnter={onEnter}
        onClick={onToggle}
        className={
          "flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors font-poppins " +
          (hasActive ? `${pillClass} text-white` : "text-ink hover:bg-muted")
        }
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasActive ? "bg-white" : dotClass}`} />
        {group.label}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && pos && createPortal(
        <div
          data-dept-dropdown-portal
          className="fixed w-56 bg-background border border-border shadow-lg rounded-lg overflow-hidden z-[100]"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className={`px-3 py-2 ${pillClass} text-white`}>
            <p className="text-[10px] font-mono tracking-[0.15em] opacity-80">BUILDING</p>
            <p className="text-[12px] font-semibold font-poppins">{group.label}</p>
          </div>
          <div className="py-1">
            {groupDepts.map((d) => {
              const isActive = d.index === activeIndex;
              return (
                <button
                  key={d.acronym}
                  onClick={() => onSelect(d.index)}
                  className={
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted " +
                    (isActive ? "bg-muted" : "")
                  }
                >
                  <span className="w-4 shrink-0 flex items-center justify-center">
                    {isActive && (
                      <svg className="w-3.5 h-3.5 text-primary" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7.2l3 3 6-6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={"text-[12px] font-mono font-bold tracking-wide truncate " + (isActive ? "text-primary" : "text-ink")}>
                      {d.acronym}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{d.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function Header({ activeIndex, onJump }: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { mode, setMode, isAdmin } = useAppMode();

  const activeDept = activeIndex >= 0 ? ALL_DEPARTMENTS[activeIndex] : null;

  const selectDept = (i: number) => {
    onJump(i);
    setOpenGroup(null);
  };

  // Close on outside click. Checks both the header itself AND any portaled
  // dropdown panel (which lives in document.body, outside headerRef) —
  // outside-click is far more reliable than onMouseLeave here, since the
  // portal is no longer a DOM descendant of the nav for hover purposes.
  useEffect(() => {
    if (!openGroup) return;
    const onDocPointerDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (headerRef.current?.contains(target)) return;
      if (target.closest?.("[data-dept-dropdown-portal]")) return;
      setOpenGroup(null);
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [openGroup]);

  return (
    <header ref={headerRef} className="fixed top-0 inset-x-0 z-40 backdrop-blur-md bg-background/95 border-b border-border shadow-sm">
      <div className="mx-auto max-w-[1600px] px-6 h-16 flex items-center gap-4">
        {/* Logo */}
        <button
          onClick={() => { onJump(-1); setOpenGroup(null); }}
          className="flex items-center gap-2.5 shrink-0 font-poppins group"
        >
          <img src={niaLogo} alt="NIA seal" className="w-8 h-8 object-contain" />
          <span className="text-[15px] font-bold text-ink tracking-tight">NIA-</span>
          <span className="text-[15px] font-bold text-primary tracking-tight group-hover:underline">TOPOLOGY</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-border shrink-0" />

        {/* Group dropdown nav */}
        <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {/* Home */}
          <button
            onClick={() => { onJump(-1); setOpenGroup(null); }}
            className={
              "shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors font-poppins " +
              (activeIndex === -1 ? "bg-primary text-primary-foreground" : "text-ink hover:bg-muted")
            }
          >
            Home
          </button>

          {/* Group pills with dropdowns */}
          {GROUPS.map((g) => {
            const isOpen = openGroup === g.id;
            const groupDepts = ALL_DEPARTMENTS.filter(d => d.groupId === g.id);
            const hasActive = groupDepts.some(d => d.index === activeIndex);
            const dotClass = GROUP_DOT[g.id] ?? "bg-muted-foreground";
            const pillClass = GROUP_COLORS[g.id] ?? "bg-primary";

            return (
              <GroupNavItem
                key={g.id}
                group={g}
                groupDepts={groupDepts}
                hasActive={hasActive}
                isOpen={isOpen}
                dotClass={dotClass}
                pillClass={pillClass}
                onEnter={() => setOpenGroup(g.id)}
                onToggle={() => setOpenGroup(isOpen ? null : g.id)}
                activeIndex={activeIndex}
                onSelect={selectDept}
              />
            );
          })}

          {/* Breadcrumb chip when a dept is active */}
          {activeDept && (
            <div className="ml-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-[11px] font-mono text-muted-foreground shrink-0">
              <span>{activeDept.groupLabel}</span>
              <span>/</span>
              <span className="text-ink font-bold">{activeDept.acronym}</span>
            </div>
          )}
        </nav>

        {/* Admin/User mode toggle — client-side UI switch only, no real
            access control. "User" is the default: presentation/view-only,
            no EDIT TOPOLOGY button, 3D View becomes orbit/zoom only.
            "Admin" unlocks editing everywhere. */}
        <div className="shrink-0 flex items-center gap-0.5 p-0.5 rounded-full border border-border bg-muted/50 font-poppins">
          <button
            onClick={() => setMode("user")}
            title="Presentation / view-only"
            className={
              "text-[11px] font-semibold px-3 py-1 rounded-full transition-colors " +
              (mode === "user" ? "bg-background text-ink shadow-sm" : "text-muted-foreground hover:text-ink")
            }
          >
            User
          </button>
          <button
            onClick={() => setMode("admin")}
            title="Full editing access"
            className={
              "text-[11px] font-semibold px-3 py-1 rounded-full transition-colors " +
              (mode === "admin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-ink")
            }
          >
            Admin
          </button>
        </div>

        {/* Start CTA */}
        <button
          onClick={() => { onJump(0); setOpenGroup(null); }}
          className="shrink-0 font-poppins text-[12px] font-semibold px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Start →
        </button>
      </div>
    </header>
  );
}