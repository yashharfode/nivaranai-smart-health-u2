import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";

const items = [
  { icon: Lock, title: "AES-256 encryption", body: "End-to-end protection for every consultation and record." },
  { icon: BadgeCheck, title: "Verified doctors only", body: "Every clinician is reviewed before joining the platform." },
  { icon: ShieldCheck, title: "Secure data handling", body: "Role-based access, audit logs, and zero-trust storage." },
];

export function Trust() {
  return (
    <section id="security" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Trust & security</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Quiet by design. Secure by default.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="reveal rounded-3xl border border-border bg-card p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/15 text-success">
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
