import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-28">
        <div className="lg:col-span-7">
          <div className="reveal inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-mineral shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("hero.eyebrow")}
          </div>
          <h1 className="reveal mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="reveal mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg text-pretty">
            {t("hero.subtitle")}
          </p>
          <div className="reveal mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/demo"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-soft transition-all hover:-translate-y-0.5 hover:bg-mineral hover:shadow-elevated"
            >
              Try the live demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-3 text-sm font-medium text-foreground transition-all hover:bg-card hover:shadow-soft"
            >
              {t("hero.cta.secondary")}
            </Link>
          </div>
          <div className="reveal mt-10 flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              AES-256 encrypted
            </div>
            <div className="hidden h-3 w-px bg-border sm:block" />
            <div className="hidden sm:block">{t("hero.trust")}</div>
          </div>
        </div>

        <div className="reveal lg:col-span-5">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-accent/40 to-transparent blur-2xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-clay/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          </div>
          <span className="font-display text-[11px] tracking-wider text-muted-foreground">
            CONSULTATION · LIVE
          </span>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-secondary text-center text-[11px] font-semibold leading-7 text-mineral">
              P
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-sm text-foreground">
              I have had a sore throat and mild fever for two days.
            </div>
          </div>
          <div className="flex items-start justify-end gap-3">
            <div className="rounded-2xl rounded-tr-sm bg-primary/10 px-3.5 py-2.5 text-sm text-mineral">
              Any difficulty swallowing or body ache?
            </div>
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-primary text-center text-[11px] font-semibold leading-7 text-primary-foreground">
              AI
            </div>
          </div>

          <div className="flex h-16 items-end justify-center gap-1 rounded-2xl bg-secondary/60 p-3">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="block w-1 rounded-full bg-primary/70"
                style={{
                  height: `${20 + Math.abs(Math.sin(i * 0.6)) * 70}%`,
                  animation: `waveform 1.${(i % 9) + 1}s ease-in-out ${i * 0.04}s infinite`,
                  transformOrigin: "bottom",
                }}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-muted-foreground">Triage</p>
              <p className="mt-0.5 font-display font-semibold text-success">Routine</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-muted-foreground">Confidence</p>
              <p className="mt-0.5 font-display font-semibold text-foreground">94%</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-muted-foreground">SOAP</p>
              <p className="mt-0.5 font-display font-semibold text-primary">Drafted</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
