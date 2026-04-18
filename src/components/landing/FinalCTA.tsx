import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="reveal relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-card to-secondary p-10 shadow-elevated sm:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
          />
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">
            A note from the team
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">
            We are not just building software. We are improving healthcare outcomes.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-soft transition-all hover:-translate-y-0.5 hover:bg-mineral hover:shadow-elevated"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/signup/hospital"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              Register hospital / clinic
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
