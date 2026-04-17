import { ClipboardList, Languages, Users } from "lucide-react";

const items = [
  {
    icon: ClipboardList,
    title: "Documentation overload",
    body: "Doctors spend nearly a third of their day writing notes instead of caring for patients.",
  },
  {
    icon: Languages,
    title: "Language gap",
    body: "Patients struggle to describe symptoms across dialects, leading to missed context.",
  },
  {
    icon: Users,
    title: "Inefficient queues",
    body: "Without smart triage, urgent cases wait while routine ones take prime time slots.",
  },
];

export function Problem() {
  return (
    <section className="border-t border-border/60 bg-secondary/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">The reality</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Three quiet problems holding clinics back.
          </h2>
          <p className="mt-4 text-muted-foreground text-pretty">
            None of them are dramatic. All of them compound — and patients feel the difference every day.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="reveal group rounded-3xl border border-border bg-card p-7 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-elevated"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-mineral transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
