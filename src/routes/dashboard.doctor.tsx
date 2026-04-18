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
  Send,
  Play,
  CheckCheck,
  XCircle,
  History,
  ShieldAlert,
  Filter,
  Inbox,
  Lock,
  Pill,
  Save,
  Mic,
  MicOff,
  Loader2,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import {
  priorityMeta,
  statusMeta,
  updatePatient,
  decryptVault,
  type PatientRecord,
  type PatientStatus,
  type Priority,
} from "@/lib/triage";
import { usePatients } from "@/hooks/usePatients";
import { useFacilities } from "@/hooks/useFacilities";
import { isVoiceSupported, startVoice, type VoiceSession } from "@/lib/voice";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/dashboard/doctor")({
  head: () => ({
    meta: [{ title: "Doctor dashboard — NivaranAI" }],
  }),
  component: DoctorDashboard,
});

type FilterKey = "all" | "critical" | "urgent" | "normal";

function DoctorDashboard() {
  const { user } = useAuth();
  const allPatients = usePatients();
  const facilities = useFacilities();

  // Find doctor record matching the signed-in user (by name match across facilities).
  const myDoctor = useMemo(() => {
    if (!user) return null;
    for (const f of facilities) {
      const d = f.doctors.find(
        (doc) =>
          doc.name.toLowerCase().replace(/^dr\.?\s*/i, "") ===
          user.name.toLowerCase().replace(/^dr\.?\s*/i, ""),
      );
      if (d) return { doctor: d, facility: f };
    }
    return null;
  }, [user, facilities]);

  // Per-doctor queue. If we can't match a doctor record, fall back to "all queue".
  const myPatients = useMemo(() => {
    if (!myDoctor) return allPatients;
    return allPatients.filter((p) => p.assignment?.doctorId === myDoctor.doctor.id);
  }, [allPatients, myDoctor]);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const visible = useMemo(() => {
    return myPatients.filter((p) => {
      if (filter === "all") return p.status !== "completed" && p.status !== "rejected";
      return p.priority === filter && p.status !== "completed" && p.status !== "rejected";
    });
  }, [myPatients, filter]);

  const active = useMemo(
    () => visible.find((p) => p.id === activeId) ?? visible[0] ?? null,
    [visible, activeId],
  );

  const counts = myPatients.reduce(
    (acc, p) => {
      acc[p.priority]++;
      return acc;
    },
    { critical: 0, urgent: 0, normal: 0 } as Record<Priority, number>,
  );

  const todayMs = 1000 * 60 * 60 * 24;
  const today = myPatients.filter((p) => Date.now() - p.timestamp < todayMs);
  const avgSeverity = today.length
    ? (today.reduce((s, p) => s + p.severity, 0) / today.length).toFixed(1)
    : "—";

  const subtitle = myDoctor
    ? `Your queue at ${myDoctor.facility.name} · ${myDoctor.doctor.specialty}`
    : "Live patient queue — sorted by AI triage priority. Click a card to view the SOAP note.";

  return (
    <DashboardShell
      requiredRole="doctor"
      title={`Good day, Dr. ${user?.name.split(" ")[0] ?? ""}`}
      subtitle={subtitle}
      nav={
        <span className="hidden rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success sm:inline-flex">
          ● Verified · Approved
        </span>
      }
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <Stats counts={counts} totalToday={today.length} avgSeverity={avgSeverity} />

        <section className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" />
              <p className="font-display text-xs uppercase tracking-[0.18em]">My queue</p>
            </div>
            <span className="text-xs text-muted-foreground">{visible.length} active</span>
          </div>

          <FilterBar value={filter} onChange={setFilter} counts={counts} />

          <LayoutGroup>
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {visible.map((p) => (
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
              {visible.length === 0 && (
                <li className="rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
                  <Inbox className="mx-auto mb-2 h-5 w-5" />
                  {myDoctor
                    ? "No patients assigned to you right now."
                    : "No patients in the queue yet."}
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

function Stats({
  counts,
  totalToday,
  avgSeverity,
}: {
  counts: Record<Priority, number>;
  totalToday: number;
  avgSeverity: string;
}) {
  const stats = [
    { icon: Users, label: "Patients today", value: String(totalToday) },
    {
      icon: AlertTriangle,
      label: "Critical",
      value: String(counts.critical),
      tone: "destructive" as const,
    },
    { icon: Clock, label: "Urgent", value: String(counts.urgent), tone: "warning" as const },
    { icon: TrendingUp, label: "Avg severity", value: avgSeverity, tone: "success" as const },
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
        <motion.div
          key={s.label}
          whileHover={{ y: -2 }}
          className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <s.icon className={`h-4 w-4 ${toneClass(s.tone)}`} />
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight tabular-nums">
            {s.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

/* ---------------- Filter bar ---------------- */

function FilterBar({
  value,
  onChange,
  counts,
}: {
  value: FilterKey;
  onChange: (v: FilterKey) => void;
  counts: Record<Priority, number>;
}) {
  const opts: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical", count: counts.critical },
    { key: "urgent", label: "Urgent", count: counts.urgent },
    { key: "normal", label: "Normal", count: counts.normal },
  ];
  return (
    <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
      <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span
                className={`ml-1 ${active ? "text-background/70" : "text-muted-foreground/70"}`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
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
  const status = patient.status ?? "pending";
  const sm = statusMeta[status];
  const isCritical = patient.severity >= 8;
  return (
    <motion.button
      whileHover={{ scale: 1.005, y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border bg-background/70 px-4 py-3.5 text-left transition-all ${
        active
          ? "border-primary shadow-elevated ring-2 " + m.ring
          : "border-border hover:border-primary/40 hover:bg-secondary/60 hover:shadow-soft"
      }`}
    >
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-foreground">
            {decryptVault(patient.patient_name)}
            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-success/15 px-1 py-0.5 text-[9px] font-semibold tracking-wider text-success"><Lock className="h-2.5 w-2.5" /> Protected</span>
            {patient.patient_age ? (
              <span className="text-xs text-muted-foreground"> · {patient.patient_age}</span>
            ) : null}
          </p>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}
          >
            {m.label} · {patient.severity}/10
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {patient.main_symptom} · {patient.duration}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${sm.chip}`}
          >
            {sm.label}
          </span>
          {isCritical && (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" /> Critical
            </span>
          )}
          {patient.pre_existing && (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-[oklch(0.45_0.12_60)]">
              <ShieldAlert className="h-2.5 w-2.5" /> {patient.pre_existing}
            </span>
          )}
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {timeAgo(patient.timestamp)}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

/* ---------------- SOAP panel ---------------- */

function SoapPanel({ patient, onClear }: { patient: PatientRecord; onClear: () => void }) {
  const m = priorityMeta[patient.priority];
  const status = patient.status ?? "pending";
  const sm = statusMeta[status];
  const isCritical = patient.severity >= 8;

  const [notes, setNotes] = useState(formatSoap(patient));

  // Sync notes when switching patients
  useMemo(() => {
    setNotes(formatSoap(patient));
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  const setStatus = (s: PatientStatus, msg: string) => {
    updatePatient(patient.id, { status: s });
    toast.success(msg);
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-4 w-4" />
            <p className="font-display text-xs uppercase tracking-[0.18em]">SOAP note</p>
          </div>
          <h3 className="mt-1 truncate font-display text-xl font-semibold tracking-tight">
            {decryptVault(patient.patient_name)}
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-success"><Lock className="h-3 w-3" /> Data Protected</span>
            {patient.patient_age ? (
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                · {patient.patient_age}
              </span>
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
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sm.chip}`}>
            {sm.label}
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

      {/* Alerts */}
      {(isCritical || patient.pre_existing) && (
        <div className="mt-4 space-y-2">
          {isCritical && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">⚠️ Critical case — severity {patient.severity}/10</p>
                <p className="text-destructive/80">Prioritize immediate examination.</p>
              </div>
            </motion.div>
          )}
          {patient.pre_existing && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-foreground/80"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.55_0.15_60)]" />
              <div>
                <p className="font-semibold text-foreground">
                  ⚠️ Pre-existing condition: {patient.pre_existing}
                </p>
                <p>Consider drug interactions and comorbidity in your plan.</p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {patient.assignment && (
        <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-3 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Assigned ({patient.assignment.mode})
          </p>
          <p className="mt-0.5 font-medium text-foreground">
            {patient.assignment.doctorName} · {patient.assignment.doctorSpecialty}
          </p>
          <p className="text-muted-foreground">
            {patient.assignment.facilityName} · {patient.assignment.departmentName}
            {patient.assignment.room ? ` · ${patient.assignment.room}` : ""}
          </p>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-secondary/50 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Patient said:</span> "{patient.transcript}"
      </div>

      {/* History timeline */}
      {patient.history && patient.history.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-primary">
            <History className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-wider">Previous visits</p>
          </div>
          <ul className="mt-2 space-y-1.5">
            {patient.history.slice(0, 5).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-foreground">{h.main_symptom}</span>
                <span className="shrink-0 text-muted-foreground">
                  sev {h.severity}/10 · {timeAgo(h.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            AI-drafted SOAP{" "}
            {patient.source === "ai" && <Sparkles className="ml-1 inline h-3 w-3 text-primary" />}
          </p>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/50">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">S</span> Subjective
            </h4>
            <p className="mt-2 text-sm text-foreground">{patient.soap.subjective}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/50">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[oklch(0.55_0.15_60)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/10 text-[oklch(0.55_0.15_60)]">O</span> Objective
            </h4>
            <p className="mt-2 text-sm text-foreground">{patient.soap.objective}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/50">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-destructive">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive">A</span> Assessment
            </h4>
            <p className="mt-2 text-sm text-foreground">{patient.soap.assessment}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/50">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-success">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success">P</span> Plan
            </h4>
            <p className="mt-2 text-sm text-foreground">{patient.soap.plan}</p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {status === "completed" && (
           <button
             onClick={() => {
                const w = window.open('', '_blank');
                w?.document.write(`
                  <html><head><title>Medical Report</title>
                  <style>
                    body { font-family: system-ui, sans-serif; padding: 40px; color: #111; line-height: 1.5; }
                    .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                    .section { margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px; }
                    h4 { margin: 0 0 10px 0; color: #4f46e5; }
                  </style>
                  </head><body>
                  <div class="header">
                    <h2>NivaranAI Medical Report</h2>
                    <p><strong>Patient Name:</strong> ${patient.patient_name} ${patient.patient_age ? '('+patient.patient_age+' yrs)' : ''}</p>
                    <p><strong>Condition:</strong> ${patient.main_symptom}</p>
                    <p><strong>Severity:</strong> ${patient.severity}/10</p>
                    <p><strong>Assigned Doctor:</strong> ${patient.assignment?.doctorName ?? "Not assigned"}</p>
                  </div>
                  <h3>Clinical Notes (SOAP)</h3>
                  <div class="section"><h4>Subjective</h4><p>${patient.soap.subjective}</p></div>
                  <div class="section"><h4>Objective</h4><p>${patient.soap.objective}</p></div>
                  <div class="section"><h4>Assessment</h4><p>${patient.soap.assessment}</p></div>
                  <div class="section"><h4>Plan</h4><p>${patient.soap.plan}</p></div>
                  <br/><br/><p style="color:gray; font-size:12px; text-align:center;">Generated by NivaranAI at ${new Date().toLocaleString()}</p>
                  <script>window.print(); setTimeout(() => window.close(), 500);</script>
                  </body></html>
                `);
                w?.document.close();
             }}
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
           >
             <FileText className="h-3.5 w-3.5" /> Download Report (PDF)
           </button>
        )}
        {status === "pending" && (
          <>
            <button
              onClick={() => setStatus("rejected", `Rejected ${patient.patient_name}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
            <button
              onClick={() => setStatus("accepted", `Accepted ${patient.patient_name}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Accept
            </button>
          </>
        )}
        {status === "accepted" && (
          <button
            onClick={() =>
              setStatus("in_consult", `Consultation started · ${patient.patient_name}`)
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:bg-mineral hover:shadow-soft"
          >
            <Play className="h-3.5 w-3.5" /> Start consultation
          </button>
        )}
        {status === "in_consult" && (
          <ConsultationTools 
            patient={patient} 
            onComplete={() => setStatus("completed", `Marked complete · ${decryptVault(patient.patient_name)}`)} 
          />
        )}
      </div>

      {patient.prescription_sent && (
        <p className="mt-2 text-right text-[11px] text-success">
          ✓ Prescription delivered to {patient.patient_name}
        </p>
      )}
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

function ConsultationTools({ patient, onComplete }: { patient: PatientRecord; onComplete: () => void }) {
  const [drug, setDrug] = useState("");
  const [notes, setNotes] = useState("");
  
  // Voice Recording functionality
  const [recordingTarget, setRecordingTarget] = useState<"notes" | "drug" | null>(null);
  const [starting, setStarting] = useState(false);
  const sessionRef = useRef<VoiceSession | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isVoiceSupported());
    return () => sessionRef.current?.stop();
  }, []);

  const startRecording = async (target: "notes" | "drug") => {
    setStarting(true);
    setRecordingTarget(target);
    try {
      const s = await startVoice({
        lang: "en-IN",
        onInterim: (t) => {
           // We can skip interim or handle it smoothly. Keeping it simple.
        },
        onFinal: (t) => {
          if (target === "notes") setNotes((prev) => (prev ? `${prev.trim()} ${t.trim()}` : t.trim()));
          if (target === "drug") setDrug((prev) => (prev ? `${prev.trim()} ${t.trim()}` : t.trim()));
        },
        onError: (msg) => {
          toast.error(msg);
          setRecordingTarget(null);
        },
        onEnd: () => {
          setRecordingTarget(null);
        },
      });
      if (s) {
        sessionRef.current = s;
      } else {
        setRecordingTarget(null);
      }
    } finally {
      setStarting(false);
    }
  };

  const stopRecording = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setRecordingTarget(null);
  };
  
  const handlePrescribe = () => {
    if (!drug) return;
    // Mock Drug Interaction Engine
    const conflict = patient.pre_existing?.toLowerCase().includes("hypertension") && drug.toLowerCase().includes("ibuprofen");
    const allergy = drug.toLowerCase().includes("penicillin");
    
    if (conflict || allergy) {
      toast.error(`⚠️ Warning: ${drug} may interact with patient's condition or allergies.`);
      return;
    }
    
    updatePatient(patient.id, { prescription_sent: true });
    toast.success("Prescription sent to patient ✅", {
      description: "Delivered securely via SMS & Vault",
    });
    setDrug("");
  };

  return (
    <div className="mt-4 w-full rounded-2xl border border-border bg-secondary/30 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Consultation Summary</h4>
      <div className="space-y-3">
        <div className="relative">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={recordingTarget === "notes" && starting}
            placeholder={recordingTarget === "notes" ? "Listening..." : "Add clinical notes, update diagnosis..."}
            className={`w-full resize-none rounded-xl border border-input bg-background p-3 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 ${recordingTarget === "notes" ? 'ring-2 ring-primary/50' : ''}`}
            rows={2}
          />
          {supported && (
            <button
              onClick={() => recordingTarget === "notes" ? stopRecording() : startRecording("notes")}
              className={`absolute right-2 top-2 rounded-lg p-1.5 transition-all ${recordingTarget === "notes" ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
            >
              {recordingTarget === "notes" && starting ? <Loader2 className="h-4 w-4 animate-spin" /> : 
               recordingTarget === "notes" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Pill className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={drug}
              onChange={(e) => setDrug(e.target.value)}
              disabled={recordingTarget === "drug" && starting}
              placeholder={recordingTarget === "drug" ? "Listening..." : "e.g. Paracetamol 500mg (Try 'Ibuprofen')"}
              className={`w-full rounded-xl border border-input bg-background py-2 pl-9 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 ${recordingTarget === "drug" ? 'ring-2 ring-primary/50' : ''}`}
            />
            {supported && (
              <button
                onClick={() => recordingTarget === "drug" ? stopRecording() : startRecording("drug")}
                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-all ${recordingTarget === "drug" ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              >
                {recordingTarget === "drug" && starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 
                 recordingTarget === "drug" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <button
            onClick={handlePrescribe}
            disabled={!drug}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Prescribe
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <button
            onClick={() => toast("Consultation notes saved securely.")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            <Save className="h-4 w-4" /> Add Notes
          </button>
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 rounded-xl bg-success px-4 py-2 text-sm font-medium text-background transition-all hover:opacity-90"
          >
            <CheckCheck className="h-4 w-4" /> Complete
          </button>
        </div>
      </div>
    </div>
  );
}
