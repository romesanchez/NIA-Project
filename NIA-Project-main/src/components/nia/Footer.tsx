import niaLogo from "@/assets/nia-logo.png";

export function Footer() {
  return (
    <footer
      className="relative border-t border-border snap-end min-h-[160px] flex items-center"
      style={{
        background: "linear-gradient(135deg, oklch(1 0 0) 0%, oklch(1 0 0) 55%, oklch(0.97 0.03 150) 75%, oklch(0.88 0.1 150) 100%)",
      }}
    >
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12 py-10 flex flex-wrap items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-2">
          <img src={niaLogo} alt="NIA logo" className="w-5 h-5 object-contain" />
          <span className="font-mono font-bold text-[11px] tracking-[0.2em] text-ink">NIA</span>
          <span className="font-mono font-bold text-[11px] tracking-[0.2em] text-primary">TOPOLOGY</span>
          <span className="font-mono font-bold text-[11px] tracking-[0.2em] text-muted-foreground">/ © {new Date().getFullYear()}</span>
        </div>
        <div className="font-mono font-bold text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          A field study by the Network Architecture Studio
        </div>
      </div>
    </footer>
  );
}