import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  Languages,
  Clock,
  FileText,
  Activity,
  CheckCircle2,
  Building2,
  Stethoscope,
  Wand2,
  ListChecks,
  ChevronRight,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import {
  addPatient,
  analyzeTranscript,
  getPriority,
  priorityMeta,
  type Assignment,
  type PatientRecord,
  type TriageResult,
} from "@/lib/triage";
import { usePatients } from "@/hooks/usePatients";
import { useFacilities } from "@/hooks/useFacilities";
import { type Doctor, type Facility } from "@/lib/hospitals";
import {
  isInIframe,
  isVoiceSupported,
  startVoice,
  type VoiceLang,
  type VoiceSession,
} from "@/lib/voice";

export const Route = createFileRoute("/dashboard/patient")({
  head: () => ({ meta: [{ title: "Patient dashboard — NivaranAI" }] }),
  component: PatientDashboard,
});

function PatientDashboard() {
  const { user } = useAuth();
  const allPatients = usePatients();

  const mine = allPatients.filter(
    (p) => user && p.patient_name.toLowerCase() === user.name.toLowerCase(),
  );
  const latest = mine[0] ?? null;
  const queuePosition = latest ? allPatients.findIndex((p) => p.id === latest.id) + 1 : null;

  return (
    <DashboardShell
      requiredRole="patient"
      title={`Hello, ${user?.name.split(" ")[0] ?? "there"}`}
      subtitle="Describe symptoms by voice. AI triages, then we route you to the right doctor."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <PatientWizard />
        <QueueCard latest={latest} position={queuePosition} totalWaiting={allPatients.length} />
        <SubmissionsCard records={mine} />
      </div>
    </DashboardShell>
  );
}

/* ============================================================
   Patient wizard: Symptoms → Analysis → Assignment
   ============================================================ */

type Step = 1 | 2 | 3;

function PatientWizard() {
  const { user } = useAuth();
  const facilities = useFacilities().filter((f) => f.status === "approved");

  const [step, setStep] = useState<Step>(1);
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<
    (TriageResult & { suggested_department?: string }) | null
  >(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);

  const allDepartmentNames = useMemo(() => {
    const set = new Set<string>();
    facilities.forEach((f) => f.departments.forEach((d) => set.add(d.name)));
    return Array.from(set);
  }, [facilities]);

  const reset = () => {
    setStep(1);
    setTranscript("");
    setAnalysis(null);
    setAssignment(null);
  };

  const runAnalyze = async (text: string) => {
    setAnalyzing(true);
    try {
      const result = await analyzeTranscript(text, allDepartmentNames);
      setAnalysis(result);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not analyze. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const finalize = (a: Assignment) => {
    if (!analysis) return;
    const priority = getPriority(analysis.severity);
    const rec: PatientRecord = {
      ...analysis,
      id: `p-${Date.now()}`,
      patient_name: user?.name ?? `Patient ${Math.floor(Math.random() * 900) + 100}`,
      patient_age: (user as any)?.age,
      patient_gender: (user as any)?.gender,
      transcript,
      priority,
      status: "pending",
      timestamp: Date.now(),
      assignment: a,
      suggested_department: analysis.suggested_department,
    };
    addPatient(rec);
    setAssignment(a);
    setStep(3);
    toast.success(`Assigned to ${a.doctorName} · ${priorityMeta[priority].label}`);
  };

  return (
    <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <Stepper step={step} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <SymptomsStep
              transcript={transcript}
              setTranscript={setTranscript}
              onNext={() => runAnalyze(transcript.trim())}
              analyzing={analyzing}
            />
          </motion.div>
        )}
        {step === 2 && analysis && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <AssignStep
              analysis={analysis}
              facilities={facilities}
              onBack={() => setStep(1)}
              onAssign={finalize}
            />
          </motion.div>
        )}
        {step === 3 && assignment && analysis && (
          <motion.div
            key="s3"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <SuccessStep assignment={assignment} severity={analysis.severity} onAgain={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Symptoms" },
    { n: 2, label: "AI Analysis" },
    { n: 3, label: "Assignment" },
  ];
  return (
    <div className="mb-6 flex items-center gap-2">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <div key={it.n} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all ${
                done
                  ? "border-success bg-success text-background"
                  : active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : it.n}
            </div>
            <span
              className={`text-xs font-medium ${active || done ? "text-foreground" : "text-muted-foreground"}`}
            >
              {it.label}
            </span>
            {i < items.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Step 1 — Symptoms (voice + text) ---- */

function SymptomsStep({
  transcript,
  setTranscript,
  onNext,
  analyzing,
}: {
  transcript: string;
  setTranscript: (v: string) => void;
  onNext: () => void;
  analyzing: boolean;
}) {
  const [lang, setLang] = useState<VoiceLang>("en-IN");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [starting, setStarting] = useState(false);
  const sessionRef = useRef<VoiceSession | null>(null);

  useEffect(() => {
    setSupported(isVoiceSupported());
    return () => sessionRef.current?.stop();
  }, []);

  const start = async () => {
    setInterim("");
    setStarting(true);
    try {
      const s = await startVoice({
        lang,
        onInterim: setInterim,
        onFinal: (t) => {
          setTranscript(transcript ? `${transcript.trim()} ${t.trim()}` : t.trim());
          setInterim("");
        },
        onError: (msg) => {
          toast.error(msg);
          setRecording(false);
        },
        onEnd: () => {
          setInterim("");
          setRecording(false);
        },
      });
      if (s) {
        sessionRef.current = s;
        setRecording(true);
      }
    } finally {
      setStarting(false);
    }
  };

  const stop = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setRecording(false);
  };

  const display = transcript + (interim ? ` ${interim}` : "");

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Step 1</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Describe your symptoms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Speak naturally — you can edit the transcript before sending.
          </p>
        </div>
        <button
          onClick={() => setLang(lang === "en-IN" ? "hi-IN" : "en-IN")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Languages className="h-3.5 w-3.5" />
          {lang === "en-IN" ? "EN" : "हिं"}
        </button>
      </div>

      <div className="mt-5 flex h-24 items-end justify-center gap-1 rounded-2xl bg-secondary/60 p-3">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="block w-1 rounded-full bg-primary/70"
            style={{
              height: recording
                ? `${20 + Math.abs(Math.sin(i * 0.6 + Date.now() / 400)) * 75}%`
                : "20%",
              transition: "height 200ms ease",
              animation: recording
                ? `waveform 1.${(i % 9) + 1}s ease-in-out ${i * 0.04}s infinite`
                : undefined,
              transformOrigin: "bottom",
            }}
          />
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        {!recording ? (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={start}
            disabled={!supported || analyzing || starting}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:-translate-y-0.5 hover:bg-mineral hover:shadow-elevated disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {starting ? "Requesting mic…" : "Start speaking"}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-medium text-destructive-foreground"
          >
            <MicOff className="h-4 w-4" /> Stop
          </motion.button>
        )}
      </div>

      {!supported && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Mic isn't supported here — type your symptoms below instead.
        </p>
      )}

      {supported && isInIframe() && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-center text-[11px] text-foreground/80">
          Mic may be blocked inside the preview iframe. If "Start speaking" does nothing, click the{" "}
          <span className="font-semibold">↗ Open in new tab</span> button at the top of the preview,
          or just type your symptoms below.
        </div>
      )}

      <div className="mt-5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Transcript {interim && <span className="text-primary">· listening…</span>}
        </label>
        <textarea
          value={display}
          onChange={(e) => {
            setTranscript(e.target.value);
            setInterim("");
          }}
          rows={4}
          placeholder='e.g. "I have a sore throat and fever for two days."'
          className="mt-1.5 w-full resize-none rounded-2xl border border-input bg-background p-4 text-sm leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        disabled={analyzing || !transcript.trim()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-mineral px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-elevated disabled:opacity-50"
      >
        {analyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> AI is analyzing…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Analyze with AI
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </motion.button>
    </div>
  );
}

/* ---- Step 2 — AI summary + manual / auto-assign ---- */

function AssignStep({
  analysis,
  facilities,
  onBack,
  onAssign,
}: {
  analysis: TriageResult & { suggested_department?: string };
  facilities: Facility[];
  onBack: () => void;
  onAssign: (a: Assignment) => void;
}) {
  const priority = getPriority(analysis.severity);
  const m = priorityMeta[priority];

  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // Manual selection state
  const [facilityId, setFacilityId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");

  const selectedFacility = facilities.find((f) => f.id === facilityId);
  const departmentDoctors =
    selectedFacility?.doctors.filter((d) => d.departmentId === departmentId) ?? [];

  const buildAssignment = (
    f: Facility,
    departmentName: string,
    departmentIdResolved: string,
    doctor: Doctor,
    chosenMode: "auto" | "manual",
  ): Assignment => ({
    facilityId: f.id,
    facilityName: f.name,
    facilityType: f.type,
    departmentId: departmentIdResolved,
    departmentName,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorSpecialty: doctor.specialty,
    room: doctor.room,
    mode: chosenMode,
  });

  const autoAssign = () => {
    const dept = analysis.suggested_department ?? "General Medicine";
    // Find any approved facility with this department + an available doctor.
    for (const f of facilities) {
      const matchedDept = f.departments.find((d) => d.name.toLowerCase() === dept.toLowerCase());
      if (!matchedDept) continue;
      const doc = f.doctors.find((d) => d.departmentId === matchedDept.id && d.available !== false);
      if (doc) return onAssign(buildAssignment(f, matchedDept.name, matchedDept.id, doc, "auto"));
    }
    // Fallback: any facility with any available doctor in General Medicine
    for (const f of facilities) {
      const general = f.departments.find((d) => /general/i.test(d.name));
      if (!general) continue;
      const doc = f.doctors.find((d) => d.departmentId === general.id && d.available !== false);
      if (doc) return onAssign(buildAssignment(f, general.name, general.id, doc, "auto"));
    }
    // Final fallback: literally any available doctor anywhere
    for (const f of facilities) {
      const doc = f.doctors.find((d) => d.available !== false);
      if (doc) {
        const dDept = f.departments.find((d) => d.id === doc.departmentId);
        return onAssign(
          buildAssignment(f, dDept?.name ?? "General", doc.departmentId, doc, "auto"),
        );
      }
    }
    toast.error("No approved doctors available right now. Please try manual selection.");
  };

  const manualAssign = () => {
    const f = facilities.find((x) => x.id === facilityId);
    const dept = f?.departments.find((d) => d.id === departmentId);
    const doc = f?.doctors.find((d) => d.id === doctorId);
    if (!f || !dept || !doc) {
      toast.error("Pick hospital, department, and doctor.");
      return;
    }
    onAssign(buildAssignment(f, dept.name, dept.id, doc, "manual"));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Step 2</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Choose your doctor</h2>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <ArrowLeft className="h-3 w-3" /> Edit symptoms
        </button>
      </div>

      {/* AI summary card */}
      <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">AI assessment</p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}>
            {m.label} · {analysis.severity}/10
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">{analysis.main_symptom}</p>
        <p className="text-xs text-muted-foreground">{analysis.duration}</p>
        {analysis.suggested_department && (
          <p className="mt-2 text-xs">
            <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
            Suggested department:{" "}
            <span className="font-semibold text-foreground">{analysis.suggested_department}</span>
          </p>
        )}
      </div>

      {/* Mode toggle */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ModeButton
          active={mode === "auto"}
          onClick={() => setMode("auto")}
          icon={Wand2}
          label="Auto-assign"
          desc="AI picks the best doctor"
        />
        <ModeButton
          active={mode === "manual"}
          onClick={() => setMode("manual")}
          icon={ListChecks}
          label="Manual"
          desc="Pick hospital & doctor"
        />
      </div>

      {mode === "auto" ? (
        <button
          onClick={autoAssign}
          disabled={facilities.length === 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-mineral px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-elevated disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" /> Auto-assign me to a doctor
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          <Select
            label="Hospital / Clinic"
            value={facilityId}
            onChange={(v) => {
              setFacilityId(v);
              setDepartmentId("");
              setDoctorId("");
            }}
            placeholder="Select facility"
            options={facilities.map((f) => ({
              value: f.id,
              label: `${f.name} (${f.type})`,
            }))}
          />
          <Select
            label="Department"
            value={departmentId}
            onChange={(v) => {
              setDepartmentId(v);
              setDoctorId("");
            }}
            placeholder={selectedFacility ? "Select department" : "Pick facility first"}
            options={(selectedFacility?.departments ?? []).map((d) => ({
              value: d.id,
              label: d.name,
            }))}
            disabled={!selectedFacility}
          />
          <Select
            label="Doctor"
            value={doctorId}
            onChange={setDoctorId}
            placeholder={departmentId ? "Select doctor" : "Pick department first"}
            options={departmentDoctors.map((d) => ({
              value: d.id,
              label: `${d.name} · ${d.specialty}${d.room ? ` · ${d.room}` : ""}`,
            }))}
            disabled={!departmentId}
          />
          <button
            onClick={manualAssign}
            disabled={!doctorId}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background hover:bg-mineral disabled:opacity-50"
          >
            Confirm assignment <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {facilities.length === 0 && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-foreground/80">
          No approved hospitals or clinics yet. Ask an admin to approve one.
        </p>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-2 rounded-2xl border p-3 text-left text-sm transition-all ${
        active
          ? "border-foreground bg-foreground text-background shadow-soft"
          : "border-border bg-background text-foreground hover:border-foreground/40"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div>
        <div className="font-medium">{label}</div>
        <div className={`text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>
          {desc}
        </div>
      </div>
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---- Step 3 — Success / assignment card ---- */

function SuccessStep({
  assignment,
  severity,
  onAgain,
}: {
  assignment: Assignment;
  severity: number;
  onAgain: () => void;
}) {
  const m = priorityMeta[getPriority(severity)];
  const Icon = assignment.facilityType === "Hospital" ? Building2 : Stethoscope;
  return (
    <div>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <p className="font-display text-xs uppercase tracking-[0.18em] text-success">Assigned</p>
      </div>
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">You're booked in</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {assignment.mode === "auto" ? "AI auto-assigned" : "You chose"} the best-fit doctor based on
        your symptoms.
      </p>

      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="mt-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-secondary/40 p-5 shadow-elevated"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {assignment.doctorSpecialty}
            </p>
            <h3 className="font-display text-lg font-semibold leading-tight">
              {assignment.doctorName}
            </h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {assignment.facilityName} ·{" "}
              {assignment.departmentName}
            </div>
            {assignment.room && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                <MapPin className="h-3 w-3" /> {assignment.room}
              </div>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}
          >
            {m.label}
          </span>
        </div>
      </motion.div>

      <button
        onClick={onAgain}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-secondary"
      >
        Start another consultation
      </button>
    </div>
  );
}

/* ============================================================
   Queue / status card
   ============================================================ */

function QueueCard({
  latest,
  position,
  totalWaiting,
}: {
  latest: PatientRecord | null;
  position: number | null;
  totalWaiting: number;
}) {
  const status = (latest?.status ?? "pending") as NonNullable<PatientRecord["status"]>;
  const steps: Array<{ key: NonNullable<PatientRecord["status"]>; label: string }> = [
    { key: "pending", label: "Submitted" },
    { key: "accepted", label: "Doctor accepted" },
    { key: "in_consult", label: "In consultation" },
    { key: "completed", label: "Completed" },
  ];
  const activeIdx = status === "rejected" ? -1 : steps.findIndex((s) => s.key === status);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-primary">
        <Clock className="h-4 w-4" />
        <p className="font-display text-xs uppercase tracking-[0.18em]">Queue status</p>
      </div>

      {latest && position ? (
        <>
          <p className="mt-4 font-display text-4xl font-semibold tracking-tight">#{position}</p>
          <p className="mt-1 text-sm text-muted-foreground">of {totalWaiting} patients waiting</p>

          <div className="mt-6 rounded-2xl bg-secondary/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Triage priority</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityMeta[latest.priority].chip}`}
              >
                {priorityMeta[latest.priority].label}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{latest.main_symptom}</p>
            <p className="text-xs text-muted-foreground">{latest.duration}</p>
            {latest.assignment && (
              <div className="mt-3 rounded-xl border border-border bg-background p-3 text-xs">
                <p className="font-medium text-foreground">{latest.assignment.doctorName}</p>
                <p className="text-muted-foreground">
                  {latest.assignment.facilityName} · {latest.assignment.departmentName}
                  {latest.assignment.room ? ` · ${latest.assignment.room}` : ""}
                </p>
              </div>
            )}
          </div>

          {/* Live status timeline */}
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Live status
            </p>
            {status === "rejected" ? (
              <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                ❌ The doctor has declined this consultation. Please try another doctor.
              </div>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {steps.map((s, i) => {
                  const done = i < activeIdx;
                  const active = i === activeIdx;
                  return (
                    <li key={s.key} className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${
                          done
                            ? "border-success bg-success text-background"
                            : active
                              ? "border-primary bg-primary text-primary-foreground animate-pulse"
                              : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <span
                        className={`text-xs ${active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {s.label}
                        {active && <span className="ml-1.5 text-primary">· now</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {latest.prescription_sent && (
              <div className="mt-3 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success">
                💊 Prescription received from {latest.assignment?.doctorName ?? "your doctor"}.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-muted-foreground">
            —
          </p>
          <p className="mt-1 text-sm text-muted-foreground">No active consultation</p>
          <div className="mt-6 rounded-2xl bg-secondary/60 p-4 text-xs text-muted-foreground">
            Speak your symptoms to join the queue. The doctor will see your SOAP note instantly.
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Submissions / history
   ============================================================ */

function SubmissionsCard({ records }: { records: PatientRecord[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="lg:col-span-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-primary">
        <Activity className="h-4 w-4" />
        <p className="font-display text-xs uppercase tracking-[0.18em]">My consultations</p>
      </div>

      {records.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
          Nothing here yet — your past consultations will appear once you send symptoms to the
          doctor.
        </div>
      ) : (
        <ol className="mt-5 space-y-2">
          {records.map((r) => {
            const open = openId === r.id;
            const m = priorityMeta[r.priority];
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-background/60">
                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{r.main_symptom}</p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(r.timestamp)} · severity {r.severity}/10 · {r.duration}
                      {r.assignment && ` · ${r.assignment.doctorName}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}
                  >
                    {m.label}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 border-t border-border px-4 py-4 text-sm">
                        {r.assignment && (
                          <div className="rounded-xl bg-secondary/60 p-3 text-xs">
                            <p className="font-semibold text-foreground">
                              {r.assignment.doctorName}
                            </p>
                            <p className="text-muted-foreground">
                              {r.assignment.facilityName} · {r.assignment.departmentName}
                              {r.assignment.room ? ` · ${r.assignment.room}` : ""}
                            </p>
                          </div>
                        )}
                        <SoapBlock label="Subjective" text={r.soap.subjective} />
                        <SoapBlock label="Objective" text={r.soap.objective} />
                        <SoapBlock label="Assessment" text={r.soap.assessment} />
                        <SoapBlock label="Plan" text={r.soap.plan} />
                        <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                          <FileText className="mr-1.5 inline h-3 w-3" />
                          Transcript: {r.transcript}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function SoapBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
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
