import { useEffect, useRef, useState } from "react";

function Counter({
  to,
  suffix = "",
  duration = 1600,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - t, 3);
              setVal(Math.round(to * eased));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

export function Impact() {
  return (
    <section
      id="impact"
      className="border-t border-border/60 bg-gradient-to-b from-background to-secondary/40 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Impact</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Measured in time given back.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Stat label="Minutes saved per patient" value={7} suffix=" min" />
          <Stat label="Hours saved per clinic, per week" value={28} suffix=" hrs" />
          <Stat label="Documentation efficiency" value={62} suffix="%" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="reveal rounded-3xl border border-border bg-card p-8 shadow-soft">
      <p className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
        <Counter to={value} suffix={suffix} />
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
