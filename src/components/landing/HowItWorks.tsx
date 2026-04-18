const steps = [
  {
    n: "01",
    title: "Patient speaks symptoms",
    body: "Natural voice input — English or Hindi, no forms to fill.",
  },
  {
    n: "02",
    title: "AI asks smart questions",
    body: "Adaptive follow-ups uncover the full clinical picture.",
  },
  {
    n: "03",
    title: "SOAP notes generated",
    body: "Subjective, Objective, Assessment, Plan — drafted automatically.",
  },
  {
    n: "04",
    title: "Doctor reviews",
    body: "Edit in place, add nuance, approve in under a minute.",
  },
  {
    n: "05",
    title: "Voice prescription sent",
    body: "Delivered to the patient on WhatsApp in plain language.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/60 bg-secondary/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Five calm steps, start to finish.
          </h2>
        </div>

        <ol className="mt-14 space-y-4">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="reveal grid grid-cols-[auto_1fr] items-start gap-5 rounded-3xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:grid-cols-[auto_1fr_auto] sm:gap-8 sm:p-7"
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              <div className="font-display text-2xl font-semibold tabular-nums text-primary sm:text-3xl">
                {s.n}
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
              <div className="col-span-2 hidden h-px w-full bg-gradient-to-r from-transparent via-border to-transparent sm:col-span-1 sm:block sm:h-12 sm:w-px sm:bg-gradient-to-b" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
