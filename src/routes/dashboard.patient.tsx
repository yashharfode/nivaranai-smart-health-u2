import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mic, MicOff, Loader2, Sparkles, Send, Languages, Clock, FileText, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { addPatient, analyzeTranscript, getPriority, priorityMeta, type PatientRecord } from "@/lib/triage";
import { usePatients } from "@/hooks/usePatients";
import { isVoiceSupported, startVoice, type VoiceLang, type VoiceSession } from "@/lib/voice";

export const Route = createFileRoute("/dashboard/patient")({
  head: () => ({
    meta: [{ title: "Patient dashboard — NivaranAI" }],
  }),
  component: PatientDashboard,
});

function PatientDashboard() {
  const { user } = useAuth();
  const allPatients = usePatients();

  // Patients submitted by *this* user (matched by name) — purely cosmetic.
  const mine = allPatients.filter(
    (p) => user && p.patient_name.toLowerCase() === user.name.toLowerCase(),
  );
  const latest = mine[0] ?? null;
  const queuePosition = latest ? allPatients.findIndex((p) => p.id === latest.id) + 1 : null;

  return (
    <DashboardShell
      requiredRole="patient"
      title={`Hello, ${user?.name.split(" ")[0] ?? "there"}`}
      subtitle="Describe your symptoms by voice — we'll send a SOAP summary to the doctor in real time."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <VoiceConsultCard />
        <QueueCard latest={latest} position={queuePosition} totalWaiting={allPatients.length} />
        <SubmissionsCard records={mine} />
      </div>
    </DashboardShell>
  );
}

/* ============================================================
   Voice consultation card
   ============================================================ */

function VoiceConsultCard() {
  const { user } = useAuth();
  const [lang, setLang] = useState<VoiceLang>("en-IN");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [supported, setSupported] = useState(true);
  const sessionRef = useRef<VoiceSession | null>(null);

  useEffect(() => {
    setSupported(isVoiceSupported());
    return () => sessionRef.current?.stop();
  }, []);

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

  const submit = async () => {
    const final = transcript.trim();
    if (!final) {
      toast.error("Please describe your symptoms first.");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeTranscript(final);
      const priority = getPriority(result.severity);
      const rec: PatientRecord = {
        ...result,
        id: `p-${Date.now()}`,
        patient_name: user?.name ?? `Patient ${Math.floor(Math.random() * 900) + 100}`,
        patient_age: (user as any)?.age,
        patient_gender: (user as any)?.gender,
        transcript: final,
        priority,
        status: "waiting",
        timestamp: Date.now(),
      };
      addPatient(rec);
      toast.success(`Sent to doctor · ${priorityMeta[priority].label}`);
      setTranscript("");
      setInterim("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not analyze. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const display = transcript + (interim ? ` ${interim}` : "");

  return (
    <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Voice consultation</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Describe your symptoms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Speak naturally. AI prepares a SOAP summary and sends it to the doctor's queue.
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
              height: recording ? `${20 + Math.abs(Math.sin(i * 0.6 + Date.now() / 400)) * 75}%` : "20%",
              transition: "height 200ms ease",
              animation: recording ? `waveform 1.${(i % 9) + 1}s ease-in-out ${i * 0.04}s infinite` : undefined,
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
            disabled={!supported || analyzing}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:-translate-y-0.5 hover:bg-mineral hover:shadow-elevated disabled:opacity-50"
          >
            <Mic className="h-4 w-4" /> Start speaking
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
          Mic isn't supported on this browser — type your symptoms below instead.
        </p>
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
        onClick={submit}
        disabled={analyzing || !transcript.trim()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-mineral px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-elevated disabled:opacity-50"
      >
        {analyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending to doctor…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Send to doctor
            <Send className="h-4 w-4" />
          </>
        )}
      </motion.button>
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
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityMeta[latest.priority].chip}`}>
                {priorityMeta[latest.priority].label}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{latest.main_symptom}</p>
            <p className="text-xs text-muted-foreground">{latest.duration}</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background">
              <div
                className={`h-full rounded-full ${
                  latest.priority === "critical"
                    ? "w-11/12 bg-destructive"
                    : latest.priority === "urgent"
                      ? "w-2/3 bg-warning"
                      : "w-1/3 bg-success"
                }`}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-muted-foreground">—</p>
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
   My submissions / history card
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
          Nothing here yet — your past consultations will appear once you send symptoms to the doctor.
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
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}>
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

// keep AlertTriangle / CheckCircle2 imported for future status pills
void AlertTriangle;
void CheckCircle2;
