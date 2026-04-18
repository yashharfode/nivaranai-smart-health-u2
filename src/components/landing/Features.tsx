import { Mic, Sparkles, FileText, ListChecks, LayoutDashboard, MessageCircle } from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "Voice-based interview",
    body: "Multilingual voice intake captures symptoms naturally — no typing required.",
    span: "md:col-span-2",
  },
  {
    icon: Sparkles,
    title: "AI questioning",
    body: "Adaptive follow-ups powered by Gemini.",
    span: "",
  },
  {
    icon: FileText,
    title: "SOAP notes",
    body: "Structured clinical notes drafted automatically.",
    span: "",
  },
  {
    icon: ListChecks,
    title: "Smart triage",
    body: "Priority ranking based on severity and history.",
    span: "",
  },
  {
    icon: LayoutDashboard,
    title: "Doctor dashboard",
    body: "Patient queue, history, drug interactions — one screen.",
    span: "md:col-span-2",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp prescription",
    body: "Plain-language summaries delivered instantly.",
    span: "md:col-span-2",
  },
  {
    icon: Sparkles,
    title: "Analytics",
    body: "Clinic-level insights into patient flow and outcomes.",
    span: "",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">
            Capabilities
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a clinic needs, nothing it doesn't.
          </h2>
        </div>

        <div className="mt-12 grid auto-rows-[180px] grid-cols-1 gap-4 sm:auto-rows-[200px] md:grid-cols-4">
          {features.map((f, i) => (
            <article
              key={f.title}
              className={`reveal group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated ${f.span}`}
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/40 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-mineral transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
