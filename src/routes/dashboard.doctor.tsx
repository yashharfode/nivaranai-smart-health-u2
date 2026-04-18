import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  FileText,
  Sparkles,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { priorityMeta, type PatientRecord, type Priority } from "@/lib/triage";
import { usePatients } from "@/hooks/usePatients";

export const Route = createFileRoute("/dashboard/doctor")({
  head: () => ({
    meta: [{ title: "Doctor dashboard — NivaranAI" }],
  }),
  component: DoctorDashboard,
});

function DoctorDashboard() {
  const { user } = useAuth();
  const patients = usePatients();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(
    () => patients.find((p) => p.id === activeId) ?? patients[0] ?? null,
    [patients, activeId],
  );

  const counts = patients.reduce(
    (acc, p) => {
      acc[p.priority]++;
      return acc;
    },
    { critical: 0, urgent: 0, normal: 0 } as Record<Priority, number>,
  );

  return (
    <DashboardShell
      requiredRole="doctor"
      title={`Good day, Dr. ${user?.name.split(" ")[0] ?? ""}`}
      subtitle="Live patient queue — sorted by AI triage priority. Click a card to view the SOAP note."
      nav={
        <span className="hidden rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success sm:inline-flex">
          ● Verified · Approved
        </span>
      }
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <Stats counts={counts} total={patients.length} />

        <section className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" />
              <p className="font-display text-xs uppercase tracking-[0.18em]">Patient queue</p>
            </div>
            <span className="text-xs text-muted-foreground">{patients.length} waiting</span>
          </div>

          <LayoutGroup>
            <ul className="mt-4 space-y-2">
              <AnimatePresence initial={false}>
                {patients.map((p) => (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  >
                    <PatientRow
                      patient={p}
                      active={active?.id === p.id}
                      onClick={() => setActiveId(p.id)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
              {patients.length === 0 && (
                <li className="rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
                  No patients in the queue yet.
                </li>
              )}
            </ul>
          </LayoutGroup>
        </section>

        <section className="lg:col-span-7">
          {active ? (
            <SoapPanel patient={active} onClear={() => setActiveId(null)} />
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
              Select a patient from the queue to view their SOAP note.
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

/* ---------------- Stats ---------------- */

function Stats({ counts, total }: { counts: Record<Priority, number>; total: number }) {
  const stats = [
    { icon: Users, label: "Patients waiting", value: String(total) },
    { icon: AlertTriangle, label: "Critical", value: String(counts.critical), tone: "destructive" as const },
    { icon: Clock, label: "Urgent", value: String(counts.urgent), tone: "warning" as const },
    { icon: TrendingUp, label: "Normal", value: String(counts.normal), tone: "success" as const },
  ];
  const toneClass = (tone?: "destructive" | "warning" | "success") =>
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-[oklch(0.55_0.15_60)]"
        : tone === "success"
          ? "text-success"
          : "text-primary";

  return (
    <div className="lg:col-span-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <s.icon className={`h-4 w-4 ${toneClass(s.tone)}`} />
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight tabular-nums">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Queue row ---------------- */

function PatientRow({
  patient,
  active,
  onClick,
}: {
  patient: PatientRecord;
  active: boolean;
  onClick: () => void;
}) {
  const m = priorityMeta[patient.priority];
  return (
    <motion.button
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border bg-background/70 px-4 py-3.5 text-left transition-all ${
        active
          ? "border-primary shadow-soft ring-2 " + m.ring
          : "border-border hover:border-primary/40 hover:bg-secondary/60"
      }`}
    >
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-foreground">
            {patient.patient_name}
            {patient.patient_age ? (
              <span className="text-xs text-muted-foreground"> · {patient.patient_age}</span>
            ) : null}
          </p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}>
            {m.label} · {patient.severity}/10
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {patient.main_symptom} · {patient.duration}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {timeAgo(patient.timestamp)} {patient.source === "fallback" && "· demo"}
        </p>
      </div>
    </motion.button>
  );
}

/* ---------------- SOAP panel ---------------- */

function SoapPanel({ patient, onClear }: { patient: PatientRecord; onClear: () => void }) {
  const m = priorityMeta[patient.priority];
  const [notes, setNotes] = useState(formatSoap(patient));

  // Sync notes when switching patients
  useMemo(() => {
    setNotes(formatSoap(patient));
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-4 w-4" />
            <p className="font-display text-xs uppercase tracking-[0.18em]">SOAP note</p>
          </div>
          <h3 className="mt-1 truncate font-display text-xl font-semibold tracking-tight">
            {patient.patient_name}
            {patient.patient_age ? (
              <span className="text-base font-normal text-muted-foreground"> · {patient.patient_age}</span>
            ) : null}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {patient.main_symptom} · {patient.duration}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${m.chip}`}>
            {m.label} · {patient.severity}/10
          </span>
          <button
            onClick={onClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/50 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Patient said:</span> "{patient.transcript}"
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI-drafted SOAP {patient.source === "ai" && <Sparkles className="ml-1 inline h-3 w-3 text-primary" />}
        </p>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-2 h-64 w-full resize-none rounded-2xl border border-input bg-background p-4 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
      />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => toast("Draft saved locally.")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary"
        >
          Save draft
        </button>
        <button
          onClick={() => toast.success(`Approved & signed for ${patient.patient_name}`)}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-mineral"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & sign
        </button>
      </div>
    </div>
  );
}

function formatSoap(p: PatientRecord) {
  return `Subjective: ${p.soap.subjective}\n\nObjective: ${p.soap.objective}\n\nAssessment: ${p.soap.assessment}\n\nPlan: ${p.soap.plan}`;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}
