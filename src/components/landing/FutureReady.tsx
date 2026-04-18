import { Cloud, WifiOff } from "lucide-react";

export function FutureReady() {
  return (
    <section className="border-t border-border/60 bg-secondary/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">
            Future ready
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for what's next.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="reveal flex items-start gap-5 rounded-3xl border border-border bg-card p-7 shadow-soft">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-mineral">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">ABHA integration</h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Coming soon
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Sync with India's Ayushman Bharat Health Account for unified patient records.
              </p>
            </div>
          </div>
          <div className="reveal flex items-start gap-5 rounded-3xl border border-border bg-card p-7 shadow-soft">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-mineral">
              <WifiOff className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">Offline mode</h3>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  On the roadmap
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                For rural clinics where connectivity is intermittent — sync when online.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
