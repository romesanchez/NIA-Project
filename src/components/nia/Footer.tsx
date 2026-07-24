export function Footer() {
  return (
    <footer className="relative border-t border-border">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12 py-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
          <span className="font-mono text-[11px] tracking-[0.2em] text-ink">NIA TOPOLOGY</span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">/ © {new Date().getFullYear()}</span>
        </div>
        <div className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          A field study by the Network Architecture Studio
        </div>
      </div>
    </footer>
  );
}
