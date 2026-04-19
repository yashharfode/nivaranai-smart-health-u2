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
  Send,
  AlertTriangle,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import {
  addPatient,
  analyzeTranscript,
  decryptVault,
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
    (p) => user && decryptVault(p.patient_name).toLowerCase() === user.name.toLowerCase(),
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
  const [location, setLocation] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<
    (TriageResult & { suggested_department?: string }) | null
  >(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [isDistressed, setIsDistressed] = useState(false);
  const [sosTimer, setSosTimer] = useState<number | null>(null);
  const [gpsLocation, setGpsLocation] = useState<string | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyInput, setEmergencyInput] = useState("");

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
        () => console.warn("GPS Denied")
      );
    }
  }, []);

  const dispatchSOSAlert = () => {
    const rec: PatientRecord = {
      ...((analysis || {
        main_symptom: emergencyInput || "UNKNOWN KINETIC DISTRESS",
        duration: "Immediate",
        severity: 10,
        soap: { subjective: "Automated SOS", objective: "High stress behavior", assessment: "Distress", plan: "Immediate care" }
      }) as unknown as any),
      id: `p-sos-${Date.now()}`,
      patient_name: `[SOS ALERT] ${user?.name ?? "Anonymous"}`,
      patient_age: (user as any)?.age,
      patient_gender: (user as any)?.gender,
      patient_phone: (user as any)?.phone,
      transcript: transcript || emergencyInput || "Kinetic Distress Auto-Trigger",
      location: gpsLocation || location || "Bhopal",
      priority: "critical",
      status: "pending",
      timestamp: Date.now(),
    };
    addPatient(rec);
    toast.error(
      "🚨 EMERGENCY SOS SENT: Exact GPS and Details dispatched to nearby Hospitals and Admin.", 
      { duration: 8000 }
    );
    setStep(2);
  };

  const handleUrgentEmergency = async () => {
    if (!emergencyInput.trim()) return;
    setShowEmergencyModal(false);
    setIsDistressed(true);
    setAnalyzing(true);
    try {
      const result = await analyzeTranscript(emergencyInput + " [URGENT EMERGENCY]", allDepartmentNames);
      setAnalysis({ ...result, severity: 10 } as any);
      setStep(2);
    } catch (e: any) {
      toast.error("Routing without AI due to error.");
      setAnalysis({
          main_symptom: emergencyInput,
          duration: "Immediate",
          severity: 10,
          soap: { subjective: emergencyInput, objective: "Critical", assessment: "Emergency", plan: "Immediate routing" },
          suggested_department: "Emergency/ICU"
      } as any);
      setStep(2);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (sosTimer === null) return;
    if (sosTimer > 0) {
      const t = setTimeout(() => setSosTimer(sosTimer - 1), 1000);
      return () => clearTimeout(t);
    } else if (sosTimer === 0) {
      setSosTimer(null);
      dispatchSOSAlert();
    }
  }, [sosTimer]);

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
      if (isDistressed) {
         setSosTimer(5);
      } else {
         setStep(2);
      }
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
      patient_phone: (user as any)?.phone,
      transcript,
      location: location || "Bhopal",
      priority: isDistressed ? "critical" : priority,
      status: "pending",
      timestamp: Date.now(),
      assignment: a,
      suggested_department: analysis.suggested_department,
    };
    addPatient(rec);
    setAssignment(a);
    setStep(3);
    toast.success("Doctor Assigned Successfully ✅");
    setTimeout(() => toast.success("Patient Sent to Doctor ✅"), 800);
  };

  return (
    <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-soft relative">
      
      {sosTimer !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md rounded-3xl">
          <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-destructive/20 bg-destructive/10 p-8 text-center shadow-2xl animate-in fade-in zoom-in">
            <AlertTriangle className="mb-4 h-16 w-16 text-destructive animate-bounce" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Emergency Detected</h2>
            <p className="mt-2 text-sm text-foreground/80">Our system detected potential distress during your input session.</p>
            <div className="my-6 text-7xl font-black tabular-nums text-destructive animate-pulse">
              {sosTimer}
            </div>
            <p className="mb-8 text-xs font-semibold uppercase tracking-wider text-destructive">
              Dispatching Ambulance & GPS Alerts to Nearby Hospitals...
            </p>
            <button
               onClick={() => {
                 setSosTimer(null);
                 setStep(2);
               }}
               className="w-full rounded-xl bg-background/80 hover:bg-background py-3 text-sm font-semibold text-foreground border border-border transition-all"
            >
              I'm Okay - Cancel SOS
            </button>
          </div>
        </div>
      )}

      {showEmergencyModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md rounded-3xl p-4">
          <div className="w-full max-w-sm rounded-3xl border border-destructive/20 bg-card p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-destructive mb-2 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" /> Urgent Emergency
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please describe the main problem in 1 sentence so we can immediately get you to the right department.
            </p>
            <input
              value={emergencyInput}
              onChange={(e) => setEmergencyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrgentEmergency() }}
              autoFocus
              placeholder="E.g. Heart attack, excessive bleeding..."
              className="w-full rounded-xl border border-destructive/30 bg-destructive/5 py-3 px-4 text-sm outline-none transition-colors focus:border-destructive focus:ring-2 focus:ring-destructive/30 mb-4 text-foreground"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors"
                disabled={analyzing}
              >
                Cancel
              </button>
              <button
                onClick={handleUrgentEmergency}
                disabled={!emergencyInput.trim() || analyzing}
                className="px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {analyzing ? "Routing..." : "Route Immediately"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mb-6 flex justify-end">
          <button 
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2 rounded-full text-sm font-semibold hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-sm animate-in zoom-in"
          >
            <AlertTriangle className="h-4 w-4" />
            Urgent Emergency Bypass
          </button>
        </div>
      )}

      <Stepper step={step} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <ChatIntakeStep
              location={location}
              setLocation={setLocation}
              isDistressed={isDistressed}
              setIsDistressed={setIsDistressed}
              onNext={(full) => runAnalyze(full)}
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
              isDistressed={isDistressed}
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

/* ---- Step 1 — AI Interview (Chat) ---- */

function ChatIntakeStep({
  location,
  setLocation,
  isDistressed,
  setIsDistressed,
  onNext,
  analyzing,
}: {
  location: string;
  setLocation: (val: string) => void;
  isDistressed: boolean;
  setIsDistressed: (val: boolean) => void;
  onNext: (finalTranscript: string) => void;
  analyzing: boolean;
}) {
  const [messages, setMessages] = useState<{ role: "ai" | "user"; text: string }[]>([
    { role: "ai", text: "Hi! What brings you in today? Please describe your symptoms." }
  ]);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Voice recording state
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, recording, interim]);

  const startRecording = async () => {
    setInterim("");
    setStarting(true);
    try {
      const s = await startVoice({
        lang,
        onInterim: setInterim,
        onFinal: (t) => {
          setDraft((prev) => (prev ? `${prev.trim()} ${t.trim()}` : t.trim()));
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

  const stopRecording = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setRecording(false);
  };

  const displayDraft = draft + (interim ? ` ${interim}` : "");

  const handleSend = () => {
    if (!displayDraft.trim() || isTyping || analyzing) return;
    
    if (recording) stopRecording();
    
    const submittedText = displayDraft.trim();
    const nextMsgs = [...messages, { role: "user" as const, text: submittedText }];
    setMessages(nextMsgs);
    setDraft("");
    setInterim("");

    const userCount = nextMsgs.filter(m => m.role === "user").length;
    
    if (userCount >= 6) {
      onNext(nextMsgs.filter(m => m.role === "user").map(m => m.text).join(". "));
      return;
    }

    setIsTyping(true);
    
    // UPDATED: Using Env Variable for API Key
    const askGemini = async () => {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in .env");

        const conversationContext = nextMsgs.map(m => `${m.role === 'ai' ? 'Doctor' : 'Patient'}: ${m.text}`).join("\n");
        const prompt = `You are an intelligent, empathetic medical AI triage assistant.
The patient is reporting symptoms. Review the conversation so far:
${conversationContext}

Write exactly ONE concise, relevant follow-up question to ask the patient to better understand their condition. 
Do not provide a diagnosis. Do not output anything other than the question. Maximum 1-2 sentences.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
          })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        let q = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!q) throw new Error("No response");
        
        setMessages(prev => [...prev, { role: "ai", text: q.trim() }]);
      } catch (e: any) {
        console.error("Gemini API Error:", e.message || e);
        
        // Fallback logic remains the same
        let q = "Can you provide more details?";
        const lastUser = submittedText.toLowerCase();
        
        if (lastUser.includes('fever')) q = "How high is the fever? Do you also have body pain or chills?";
        else if (lastUser.includes('pain') || lastUser.includes('ache')) q = "How long has the pain been present, and can you describe it (sharp, dull, throbbing)?";
        else if (lastUser.match(/cough|throat/)) q = "Is it a dry cough, or are you coughing up phlegm?";
        else if (lastUser.match(/vomit|nausea|stomach/)) q = "Have you been able to keep any food or liquids down?";
        else if (lastUser.match(/breathe|breath/)) q = "Are you experiencing shortness of breath or chest tightness?";
        else if (userCount === 1) q = "Are there any other symptoms you are experiencing along with this?";
        else if (userCount === 2) q = "Have you taken any medication for this so far?";
        else if (userCount === 3) q = "Has anything made your condition better or worse?";
        else if (userCount === 4) q = "Do you have any related medical history or chronic conditions?";
        else if (userCount === 5) q = "Just one last question — on a scale of 1 to 10, how severe is your discomfort right now?";
        
        setMessages(prev => [...prev, { role: "ai", text: q }]);
      } finally {
        setIsTyping(false);
      }
    };
    
    askGemini();
  };

  const handleFinishEarly = () => {
    const userReplies = messages.filter((m) => m.role === "user");
    if (userReplies.length === 0) return;
    onNext(userReplies.map(m => m.text).join(". "));
  };

  return (
    <div className="flex flex-col space-y-4 h-[550px]">
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
        {messages.map((m, idx) => (
 
