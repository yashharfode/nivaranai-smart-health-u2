import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast, Toaster } from "sonner";
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  Send,
  X,
  Activity,
  ArrowLeft,
  Languages,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  type PatientRecord,
  type Priority,
  type TriageResult,
  getPriority,
  loadPatients,
  priorityMeta,
  savePatients,
} from "@/lib/triage";
import { isVoiceSupported, startVoice, type VoiceLang, type VoiceSession } from "@/lib/voice";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live demo — NivaranAI" },
      {
        name: "description",
        content:
          "Speak symptoms, get an AI-drafted SOAP note, and watch patients sort by priority in real time.",
      },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setPatients(loadPatients());
  }, []);

  useEffect(() => {
    if (patients.length) savePatients(patients);
  }, [patients]);

  const sorted = useMemo(
    () =>
      [...patients].sort((a, b) => {
        const r = priorityMeta[a.priority].rank - priorityMeta[b.priority].rank;
        if (r !== 0) return r;
        return b.timestamp - a.timestamp;
      }),
    [patients],
  );

  const selected = sorted.find((p) => p.id === selectedId) ?? null;

  const onAdd = (rec: PatientRecord) => {
    setPatients((prev) => [rec, ...prev]);
    setSelectedId(rec.id);
    toast.success(`${rec.patient_name} added · ${priorityMeta[rec.priority].label}`);
  };

  const onClear = () => {
    if (!confirm("Clear all patients from this demo?")) return;
    setPatients([]);
    setSelectedId(null);
    if (typeof window !== "undefined") window.localStorage.removeItem("nivaranai.patients.v1");
    toast("Cleared all patients.");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Premium gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 15% 0%, oklch(0.92 0.04 195 / 0.6), transparent 60%), radial-gradient(ellipse 50% 40% at 95% 10%, oklch(0.9 0.06 280 / 0.35), transparent 60%), radial-gradient(ellipse 60% 35% at 50% 100%, oklch(0.93 0.05 160 / 0.4), transparent 60%)",
        }}
      />

      <Toaster position="top-center" richColors closeButton />

      <header className="relative z-10 border-b border-border/60 glass-strong">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-display text-lg font-semibold tracking-tight">NivaranAI</span>
            <span className="ml-2 hidden rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary sm:inline">
              Live demo
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="hidden items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              <Trash2 className="h-3.5 w-3.5" /> Reset
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-12 lg:py-10">
        <section className="lg:col-span-5">
          <Kiosk onAdd={onAdd} />
        </section>

        <section className="lg:col-span-7">
          <TriageDashboard
            patients={sorted}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>
      </main>

      <AnimatePresence>
        {selected && (
          <SoapPanel patient={selected} onClose={() => setSelectedId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   Patient Kiosk — voice + analyze
   ============================================================ */

function Kiosk({ onAdd }: { onAdd: (p: PatientRecord) => void }) {
  const [lang, setLang] = useState<VoiceLang>("en-IN");
  const [name, setName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [supported] = useState(isVoiceSupported);
  const sessionRef = useRef<VoiceSession | null>(null);

  useEffect(() => () => sessionRef.current?.stop(), []);

  const start = () => {
    setInterim("");
    const s = startVoice({
      lang,
      onInterim: setInterim,
      onFinal: (t) => {
        setTranscript((prev) => (prev ? `${prev.trim()} ${t.trim()}` : t.trim()));
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
  };

  const stop = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setRecording(false);
  };

  const analyze = async () => {
    const final = transcript.trim();
    if (!final) {
      toast.error("Please describe symptoms first.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: final }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || `Analyze failed (${res.status})`);
        return;
      }
      const result = (await res.json()) as TriageResult;
      const priority = getPriority(result.severity);
      const rec: PatientRecord = {
        ...result,
        id: `p-${Date.now()}`,
        patient_name: name.trim() || `Patient ${Math.floor(Math.random() * 900) + 100}`,
        transcript: final,
        priority,
        timestamp: Date.now(),
      };
      onAdd(rec);
      setTranscript("");
      setInterim("");
      setName("");
    } catch (e) {
      console.error(e);
      toast.error("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const display = transcript + (interim ? ` ${interim}` : "");

  return (
    <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-elevated backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Patient kiosk</p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
            Describe your symptoms
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Speak naturally in English or Hindi. AI prepares a SOAP note for the doctor.
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

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Patient name (optional)"
        className="mt-5 w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
      />

      {/* Waveform */}
      <div className="mt-4 flex h-24 items-end justify-center gap-1 rounded-2xl bg-secondary/60 p-3">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="block w-1 rounded-full bg-primary/70"
            style={{
              height: recording ? `${20 + Math.abs(Math.sin(i * 0.6 + Date.now() / 400)) * 75}%` : "20%",
              transition: "height 200ms ease",
              animation: recording ? `waveform 1.${(i % 9) + 1}s ease-in-out ${i * 0.04}s infinite` : undefined,
              transformOrigin: "bottom",
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        {!recording ? (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={start}
            disabled={!supported || analyzing}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:-translate-y-0.5 hover:bg-mineral hover:shadow-elevated disabled:opacity-50"
          >
            <Mic className="h-4 w-4" /> Speak symptoms
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
          Mic not supported here — type your symptoms below instead.
        </p>
      )}

      {/* Editable transcript */}
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
        onClick={analyze}
        disabled={analyzing || !transcript.trim()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-mineral px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-elevated disabled:opacity-50"
      >
        {analyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Analyze with AI
            <Send className="h-4 w-4" />
          </>
        )}
      </motion.button>

      {analyzing && <SkeletonResult />}
    </div>
  );
}

function SkeletonResult() {
  return (
    <div className="mt-5 space-y-2 rounded-2xl bg-secondary/50 p-4">
      <div className="h-3 w-1/3 animate-pulse rounded bg-primary/15" />
      <div className="h-3 w-full animate-pulse rounded bg-primary/10" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-primary/10" />
    </div>
  );
}

/* ============================================================
   Triage Dashboard
   ============================================================ */

function TriageDashboard({
  patients,
  selectedId,
  onSelect,
}: {
  patients: PatientRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const counts = patients.reduce(
    (acc, p) => {
      acc[p.priority]++;
      return acc;
    },
    { critical: 0, urgent: 0, normal: 0 } as Record<Priority, number>,
  );

  return (
    <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-elevated backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Triage queue</p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Patients sorted by priority</h2>
        </div>
        <Activity className="h-5 w-5 text-primary" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <PriorityStat priority="critical" count={counts.critical} icon={AlertTriangle} />
        <PriorityStat priority="urgent" count={counts.urgent} icon={Clock} />
        <PriorityStat priority="normal" count={counts.normal} icon={CheckCircle2} />
      </div>

      <LayoutGroup>
        <ul className="mt-5 space-y-2">
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
                <PatientCard
                  patient={p}
                  active={selectedId === p.id}
                  onClick={() => onSelect(p.id)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
          {patients.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
              No patients yet — add one from the kiosk.
            </li>
          )}
        </ul>
      </LayoutGroup>
    </div>
  );
}

function PriorityStat({
  priority,
  count,
  icon: Icon,
}: {
  priority: Priority;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const m = priorityMeta[priority];
  return (
    <div className={`rounded-2xl border bg-background/60 p-3 ${m.chip}`}>
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 opacity-80" />
        <span className="font-display text-2xl font-semibold tabular-nums">{count}</span>
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-90">
        {m.label}
      </p>
    </div>
  );
}

function PatientCard({
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
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-2xl border bg-background/70 px-4 py-3.5 text-left transition-all ${
        active
          ? "border-primary shadow-soft ring-2 " + m.ring
          : "border-border hover:border-primary/40 hover:bg-secondary/60"
      }`}
    >
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-foreground">{patient.patient_name}</p>
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

/* ============================================================
   SOAP Panel
   ============================================================ */

function SoapPanel({ patient, onClose }: { patient: PatientRecord; onClose: () => void }) {
  const m = priorityMeta[patient.priority];
  return (
    <motion.aside
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 280, damping: 32 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-card shadow-elevated"
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2 text-primary">
          <Stethoscope className="h-4 w-4" />
          <p className="font-display text-xs uppercase tracking-[0.18em]">SOAP note</p>
        </div>
        <button
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-2xl font-semibold tracking-tight">{patient.patient_name}</h3>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${m.chip}`}>
            {m.label} · {patient.severity}/10
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {patient.main_symptom} · {patient.duration} · {timeAgo(patient.timestamp)}
        </p>

        <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Patient said
          </p>
          <p className="mt-1 text-sm italic leading-relaxed text-foreground">"{patient.transcript}"</p>
        </div>

        <SoapSection label="Subjective" body={patient.soap.subjective} />
        <SoapSection label="Objective" body={patient.soap.objective} />
        <SoapSection label="Assessment" body={patient.soap.assessment} />
        <SoapSection label="Plan" body={patient.soap.plan} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-secondary"
        >
          Close
        </button>
        <button
          onClick={() => toast.success("Approved & signed (demo)")}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-mineral"
        >
          <CheckCircle2 className="h-4 w-4" /> Approve & sign
        </button>
      </div>
    </motion.aside>
  );
}

function SoapSection({ label, body }: { label: string; body: string }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{body}</p>
    </div>
  );
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
