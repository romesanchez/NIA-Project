import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_DEPARTMENTS, GROUPS, TOTAL } from "@/data/departments";
import { Header } from "@/components/nia/Header";
import { Hero } from "@/components/nia/Hero";
import { DepartmentSlide } from "@/components/nia/DepartmentSlide";
import { TwoDModal } from "@/components/nia/TwoDModal";
import { Footer } from "@/components/nia/Footer";
import bgUrl from "@/assets/nia-background.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NIA Topology" },
      { property: "og:title", content: "NIA Topology" },
    ],
  }),
  component: Index,
});

// Group id → which nodes fall inside (for alternating tint)
const groupIndexMap = new Map<string, number>();
GROUPS.forEach((g, i) => groupIndexMap.set(g.id, i));

function Index() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1); // -1 = hero
  const [modal, setModal] = useState<null | { kind: "2d"; deptIndex: number; origin: { x: number; y: number } }>(null);

  const jumpTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = i < 0 ? 0 : (i + 1); // hero is child 0
    const child = el.children[target] as HTMLElement | undefined;
    if (child) child.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scrollspy via IntersectionObserver
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const sections = Array.from(el.querySelectorAll<HTMLElement>("[data-slide-index], [data-hero]"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.55) {
            const target = e.target as HTMLElement;
            if (target.dataset.hero === "1") setActiveIndex(-1);
            else if (target.dataset.slideIndex) setActiveIndex(Number(target.dataset.slideIndex) - 1);
          }
        });
      },
      { root: el, threshold: [0.55] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal) return;
      const nav = (delta: number) => { e.preventDefault(); jumpTo(Math.max(-1, Math.min(TOTAL - 1, activeIndex + delta))); };
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
          nav(1); break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          nav(-1); break;
        case "Home":
          e.preventDefault(); jumpTo(-1); break;
        case "End":
          e.preventDefault(); jumpTo(TOTAL - 1); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, jumpTo, modal]);

  const modalDept = useMemo(
    () => (modal ? ALL_DEPARTMENTS[modal.deptIndex] : null),
    [modal],
  );

  return (
    <div className="h-screen w-screen overflow-hidden text-ink">
      <Header activeIndex={activeIndex} onJump={jumpTo} />

      <div
        ref={scrollerRef}
        className="h-screen w-screen overflow-y-scroll snap-y snap-proximity scroll-smooth"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
          scrollbarWidth: "thin",
        }}
      >
        <div data-hero="1">
          <Hero onBrowse={() => jumpTo(0)} />
        </div>

        {ALL_DEPARTMENTS.map((d) => {
          const gi = groupIndexMap.get(d.groupId) ?? 0;
          return (
            <DepartmentSlide
              key={d.acronym}
              dept={d}
              tinted={gi % 2 === 1}
              onOpen2D={(e) =>
                setModal({ kind: "2d", deptIndex: d.index, origin: { x: e.clientX, y: e.clientY } })
              }
            />
          );
        })}

        <Footer />
      </div>

      {modal?.kind === "2d" && (
        <TwoDModal dept={modalDept} origin={modal.origin} onClose={() => setModal(null)} />
      )}
    </div>
  );
}