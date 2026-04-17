import { useEffect, useState } from "react";

export function Splash({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 1800);
    const t2 = setTimeout(() => onDone(), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-mineral shadow-glow" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary-foreground" fill="none">
              <path
                d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="origin-center animate-[spin_3s_linear_infinite]"
                style={{ transformOrigin: "center" }}
              />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <div className="absolute -inset-3 rounded-3xl border border-primary/20 animate-pulse-soft" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-semibold tracking-tight">NivaranAI</span>
          <span className="text-xs text-muted-foreground">thinking…</span>
        </div>
        <div className="flex h-6 items-end gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="block w-1 rounded-full bg-primary/70"
              style={{
                height: "100%",
                animation: `waveform 1.1s ease-in-out ${i * 0.12}s infinite`,
                transformOrigin: "bottom",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
