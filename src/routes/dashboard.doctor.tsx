import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Mic,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  Pill,
  FileText,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/doctor")({
  head: () => ({
    meta: [{ title: "Doctor dashboard — NivaranAI" }],
  }),
  component: DoctorDashboard,
});

type Priority = "Urgent" | "High" | "Routine";

const queue: {
  id: string;
  name: string;
  age: number;
  complaint: string;
  priority: Priority;
  wait: string;
}[] = [
  { id: "p1", name: "Aarav Sharma", age: 34, complaint: "Chest tightness, breathlessness", priority: "Urgent", wait: "2 min" },
  { id: "p2", name: "Priya Nair", age: 28, complaint: "Sore throat, fever 100°F", priority: "Routine", wait: "12 min" },
  { id: "p3", name: "Ramesh Kumar", age: 56, complaint: "Headache + high BP", priority: "High", wait: "6 min" },
  { id: "p4", name: "Sneha Patel", age: 42, complaint: "Lower back pain", priority: "Routine", wait: "18 min" },
];

function DoctorDashboard() {
  const { user } = useAuth();
  const [activeId, setActiveId] = useState(queue[0].id);
  const active = queue.find((q) => q.id === activeId)!;

  return (
    <DashboardShell
      requiredRole="doctor"
      title={`Good day, Dr. ${user?.name.split(" ")[0] ?? ""}`}
      subtitle="Smart queue, AI-drafted notes, and one-click prescriptions."
      nav={
        <span className="hidden rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success sm:inline-flex">
          ● Verified · Approved
        </span>
      }
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <Stats />

        <section className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" />
              <p className="font-display text-xs uppercase tracking-[0.18em]">Patient queue</p>
            </div>
            <span className="text-xs text-muted-foreground">{queue.length} waiting</span>
          </div>
          <ul className="mt-4 space-y-2">
            {queue.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setActiveId(p.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                    activeId === p.id
                      ? "border-primary bg-primary/5 shadow-soft"
                      : "border-border bg-background hover:border-primary/40 hover:bg-secondary/60"
                  }`}
                >
                  <PriorityDot priority={p.priority} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-foreground">
                        {p.name} <span className="text-xs text-muted-foreground">· {p.age}</span>
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{p.wait}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.complaint}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-7 grid gap-5">
          <SoapCard patient={active} />
          <PrescriptionCard />
          <DrugAlertCard />
        </section>
      </div>
    </DashboardShell>
  );
}

function Stats() {
  const stats = [
    { icon: Users, label: "Patients today", value: "18" },
    { icon: Clock, label: "Avg consult time", value: "6.4 min" },
    { icon: TrendingUp, label: "Notes auto-drafted", value: "94%" },
    { icon: CheckCircle2, label: "Approval rate", value: "98%" },
  ];
  return (
    <div className="lg:col-span-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <s.icon className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function PriorityDot({ priority }: { priority: Priority }) {
  const map = {
    Urgent: "bg-destructive",
    High: "bg-warning",
    Routine: "bg-success",
  } as const;
  return (
    <span className="mt-1.5 flex shrink-0 items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${map[priority]}`} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {priority}
      </span>
    </span>
  );
}

function SoapCard({ patient }: { patient: (typeof queue)[number] }) {
  const [notes, setNotes] = useState(
    `Subjective: ${patient.complaint}. Onset 2 days ago. No prior episodes.\n\nObjective: T 100.2°F, HR 88, BP 122/78. Throat erythematous. No lymphadenopathy.\n\nAssessment: Likely viral pharyngitis. Rule out streptococcal infection.\n\nPlan: Symptomatic management. Paracetamol PRN. Saline gargles. Review in 3 days if not improved.`,
  );
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-4 w-4" />
          <p className="font-display text-xs uppercase tracking-[0.18em]">SOAP notes · {patient.name}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          AI drafted
        </span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-4 h-56 w-full resize-none rounded-2xl border border-input bg-background p-4 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary">
          Save draft
        </button>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-mineral">
          Approve & sign
        </button>
      </div>
    </div>
  );
}

function PrescriptionCard() {
  const [recording, setRecording] = useState(false);
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Pill className="h-4 w-4" />
          <p className="font-display text-xs uppercase tracking-[0.18em]">Voice prescription</p>
        </div>
        <button
          onClick={() => setRecording((r) => !r)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            recording
              ? "bg-destructive text-destructive-foreground"
              : "bg-foreground text-background hover:bg-mineral"
          }`}
        >
          <Mic className="h-3.5 w-3.5" /> {recording ? "Stop" : "Dictate"}
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        {[
          ["Paracetamol 500mg", "1 tab BD × 3 days"],
          ["Warm saline gargle", "After meals × 5 days"],
        ].map(([n, d]) => (
          <div key={n} className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-sm">
            <span className="font-medium text-foreground">{n}</span>
            <span className="text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Patient will receive this on WhatsApp in plain language.
      </p>
    </div>
  );
}

function DrugAlertCard() {
  return (
    <div className="rounded-3xl border border-warning/30 bg-warning/5 p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-foreground">Drug interaction notice</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Patient is on long-term Warfarin (per history). Monitor INR if NSAIDs are added. Paracetamol is preferred.
          </p>
        </div>
      </div>
    </div>
  );
}
