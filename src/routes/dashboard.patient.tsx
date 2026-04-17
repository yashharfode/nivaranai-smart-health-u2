import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, MessageCircle, Clock, FileText, Pill, Activity } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/patient")({
  head: () => ({
    meta: [{ title: "Patient dashboard — NivaranAI" }],
  }),
  component: PatientDashboard,
});

const mockHistory = [
  { date: "12 Apr 2026", title: "Mild fever & sore throat", doctor: "Dr. Mehta", status: "Resolved" },
  { date: "03 Mar 2026", title: "Annual checkup", doctor: "Dr. Iyer", status: "Completed" },
  { date: "18 Jan 2026", title: "Skin rash", doctor: "Dr. Khan", status: "Resolved" },
];

const mockPrescription = {
  date: "12 Apr 2026",
  doctor: "Dr. Mehta",
  items: [
    { name: "Paracetamol 500mg", dose: "1 tablet, twice a day", duration: "3 days" },
    { name: "Warm saline gargle", dose: "After meals", duration: "5 days" },
  ],
  notes: "Rest, plenty of fluids. Return if symptoms worsen.",
};

function PatientDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell
      requiredRole="patient"
      title={`Hello, ${user?.name.split(" ")[0] ?? "there"}`}
      subtitle="Describe your symptoms by voice — we'll prepare a summary for the doctor."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <VoiceConsultCard />
        <QueueCard />
        <PrescriptionCard />
        <SummaryCard />
        <HistoryCard />
      </div>
    </DashboardShell>
  );
}

function VoiceConsultCard() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (recording) {
      tick.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [recording]);

  const start = () => {
    setRecording(true);
    setSeconds(0);
    setTranscript([]);
    // Simulate transcript chunks
    const lines = [
      "I have had a sore throat for two days.",
      "There's mild fever, around 100°F in the evening.",
      "Some difficulty swallowing, but no body ache.",
    ];
    lines.forEach((l, i) => {
      setTimeout(() => setTranscript((t) => [...t, l]), 1500 + i * 1800);
    });
  };
  const stop = () => setRecording(false);

  return (
    <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Voice consultation</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Describe your symptoms</h2>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {recording ? `Recording · ${formatTime(seconds)}` : "Idle"}
        </span>
      </div>

      <div className="mt-5 flex h-24 items-end justify-center gap-1 rounded-2xl bg-secondary/60 p-3">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="block w-1 rounded-full bg-primary/70"
            style={{
              height: recording ? `${20 + Math.abs(Math.sin(i * 0.6 + seconds)) * 75}%` : "20%",
              transition: "height 200ms ease",
              animation: recording ? `waveform 1.${(i % 9) + 1}s ease-in-out ${i * 0.04}s infinite` : undefined,
              transformOrigin: "bottom",
            }}
          />
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center">
        {!recording ? (
          <button
            onClick={start}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:-translate-y-0.5 hover:bg-mineral hover:shadow-elevated"
          >
            <Mic className="h-4 w-4" /> Start speaking
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-medium text-destructive-foreground transition-all hover:-translate-y-0.5"
          >
            <MicOff className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {transcript.length > 0 && (
        <div className="mt-6 space-y-2 rounded-2xl bg-secondary/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
          {transcript.map((line, i) => (
            <p key={i} className="text-sm text-foreground">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueCard() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-primary">
        <Clock className="h-4 w-4" />
        <p className="font-display text-xs uppercase tracking-[0.18em]">Queue status</p>
      </div>
      <p className="mt-4 font-display text-4xl font-semibold tracking-tight">#3</p>
      <p className="mt-1 text-sm text-muted-foreground">in queue with Dr. Mehta</p>

      <div className="mt-6 rounded-2xl bg-secondary/60 p-4">
        <p className="text-xs text-muted-foreground">Estimated wait</p>
        <p className="mt-1 font-display text-xl font-semibold">12 minutes</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-mineral" />
        </div>
      </div>
    </div>
  );
}

function PrescriptionCard() {
  return (
    <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Pill className="h-4 w-4" />
          <p className="font-display text-xs uppercase tracking-[0.18em]">Latest prescription</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25">
          <MessageCircle className="h-3.5 w-3.5" /> Send to WhatsApp
        </button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {mockPrescription.date} · {mockPrescription.doctor}
      </p>
      <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {mockPrescription.items.map((m) => (
          <div key={m.name} className="grid grid-cols-3 gap-3 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{m.name}</p>
            <p className="text-muted-foreground">{m.dose}</p>
            <p className="text-right text-muted-foreground">{m.duration}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-accent/40 px-4 py-3 text-sm text-mineral">{mockPrescription.notes}</p>
    </div>
  );
}

function SummaryCard() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-primary">
        <FileText className="h-4 w-4" />
        <p className="font-display text-xs uppercase tracking-[0.18em]">Consultation summary</p>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        You came in with a sore throat and mild fever for two days. The doctor diagnosed a likely viral
        infection. Take rest, stay hydrated, and follow the prescription. Return if symptoms worsen
        or last more than 5 days.
      </p>
    </div>
  );
}

function HistoryCard() {
  return (
    <div className="lg:col-span-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-primary">
        <Activity className="h-4 w-4" />
        <p className="font-display text-xs uppercase tracking-[0.18em]">Medical history</p>
      </div>
      <ol className="mt-5 space-y-4">
        {mockHistory.map((h, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-mineral">
              {i + 1}
            </div>
            <div>
              <p className="font-medium text-foreground">{h.title}</p>
              <p className="text-xs text-muted-foreground">
                {h.date} · {h.doctor}
              </p>
            </div>
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success">
              {h.status}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
