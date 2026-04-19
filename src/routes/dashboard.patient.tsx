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
      // Skip the countdown for explicit emergencies
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

  // Kinetic Triage Metrics
  const distressMetrics = useRef({
    backspaceCount: 0,
    lastKeystrokeTime: 0,
    delays: [] as number[],
  });
  const [showAnalysisTooltip, setShowAnalysisTooltip] = useState(false);

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
    
    // Stop recording first if we're sending while it's active
    if (recording) stopRecording();
    
    const submittedText = displayDraft.trim();
    const nextMsgs = [...messages, { role: "user" as const, text: submittedText }];
    setMessages(nextMsgs);
    setDraft("");
    setInterim("");

    const userCount = nextMsgs.filter(m => m.role === "user").length;
    
    // Allow up to 6 questions max
    if (userCount >= 6) {
      onNext(nextMsgs.filter(m => m.role === "user").map(m => m.text).join(". "));
      return;
    }

    setIsTyping(true);
    
    // Use Gemini API for intelligent follow-up
    const askGemini = async () => {
      try {
        const conversationContext = nextMsgs.map(m => `${m.role === 'ai' ? 'Doctor' : 'Patient'}: ${m.text}`).join("\n");
        const prompt = `You are an intelligent, empathetic medical AI triage assistant.
The patient is reporting symptoms. Review the conversation so far:
${conversationContext}

Write exactly ONE concise, relevant follow-up question to ask the patient to better understand their condition. 
Do not provide a diagnosis. Do not output anything other than the question. Maximum 1-2 sentences.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCK0BoxEwusXbaUnmUHodU6VcOg4BaFuLM`, {
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
        
        // Fallback intelligent logic
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
    onNext(userReplies.map((m) => m.text).join(". "));
  };

  return (
    <div className="flex h-[550px] flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Step 1</p>
          <h2 className="mt-1 font-display text-lg font-semibold">AI Interviewer</h2>
          <p className="mt-1 text-sm text-muted-foreground">Answer a few questions by typing or speaking.</p>
        </div>
        {supported && (
          <button
            onClick={() => setLang(lang === "en-IN" ? "hi-IN" : "en-IN")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "en-IN" ? "EN" : "हिं"}
          </button>
        )}
      </div>

      <div className="mb-4">
         <div className="relative">
           <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
           <input 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
              placeholder="Where do you live? (e.g. 6-digit Pincode like 462001)" 
              className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
           />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-3xl border border-border bg-secondary/20 p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              m.role === 'user' 
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-background border border-border rounded-bl-sm shadow-sm'
            }`}>
              {m.role === 'ai' && <Sparkles className="inline-block mr-1.5 h-3.5 w-3.5 text-primary mb-0.5" />}
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex justify-start">
             <div className="max-w-[80%] rounded-2xl bg-background border border-border rounded-bl-sm px-4 py-3 text-sm shadow-sm flex items-center gap-1.5 transition-all">
               <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce"></span>
               <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce delay-75"></span>
               <span className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce delay-150"></span>
             </div>
           </div>
        )}
        {recording && (
           <div className="flex justify-start">
             <div className="max-w-[80%] rounded-2xl bg-secondary/60 px-4 py-3 text-sm shadow-sm flex items-center gap-2 border border-border rounded-bl-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Listening</span>
                <div className="flex h-4 items-end gap-0.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span
                      key={i}
                      className="block w-1 rounded-full bg-primary/70"
                      style={{
                        height: `${20 + Math.abs(Math.sin(i * 0.6 + Date.now() / 400)) * 75}%`,
                        transition: "height 200ms ease",
                        animation: `waveform 1.${(i % 3) + 1}s ease-in-out ${i * 0.04}s infinite`,
                        transformOrigin: "bottom",
                      }}
                    />
                  ))}
                </div>
             </div>
           </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-4 flex gap-2 items-center">
        {supported && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={recording ? stopRecording : startRecording}
            disabled={starting || isTyping || analyzing}
            className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full transition-all ${
              recording 
                ? 'bg-destructive text-destructive-foreground shadow-elevated' 
                : 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground'
            } disabled:opacity-50`}
          >
            {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </motion.button>
        )}
        <div className="relative flex-1">
          <input
            value={displayDraft}
            disabled={isTyping || analyzing || (recording && starting)}
            onChange={(e) => {
              setDraft(e.target.value);
              setInterim("");
            }}
            onFocus={() => setShowAnalysisTooltip(true)}
            onBlur={() => setShowAnalysisTooltip(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
              
              const now = Date.now();
              const metrics = distressMetrics.current;
              
              if (e.key === 'Backspace') {
                metrics.backspaceCount++;
              }
              
              if (metrics.lastKeystrokeTime > 0) {
                const delay = now - metrics.lastKeystrokeTime;
                if (delay < 4000) metrics.delays.push(delay);
              }
              metrics.lastKeystrokeTime = now;
              
              // Distress Logic (Simplistic)
              if (metrics.backspaceCount > 3 && metrics.delays.length > 5) {
                 const avg = metrics.delays.reduce((a,b) => a + b, 0) / metrics.delays.length;
                 // Erratic: typing fast with many backspaces OR typing very slow with backspaces
                 if (avg > 300 || metrics.backspaceCount > 6) {
                    setIsDistressed(true);
                 }
              }
            }}
            placeholder={isTyping ? "AI is typing..." : recording ? "Listening... (or type here)" : "Type your answer..."}
            className={`w-full rounded-full border bg-background py-3.5 pl-5 pr-12 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring/30 disabled:opacity-50 ${
               isDistressed ? "border-destructive focus:border-destructive shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "border-input focus:border-primary"
            }`}
          />
          <button
            onClick={handleSend}
            disabled={(!displayDraft.trim() && !recording) || isTyping || analyzing}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-all hover:bg-mineral disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      {showAnalysisTooltip && !isDistressed && (
        <div className="mt-1 flex justify-center text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">
           Analyzing input behavior...
        </div>
      )}
      
      {isDistressed && (
        <div className="mt-2 flex justify-center text-xs font-medium text-destructive animate-pulse">
           🚨 Kinetic Distress Detected – Auto Priority Upgrade
        </div>
      )}
      
      {messages.filter(m => m.role === 'user').length > 0 && !analyzing && !isTyping && (
         <button
            onClick={handleFinishEarly}
            className="mt-3 text-xs text-muted-foreground hover:text-primary transition-colors text-center w-full"
         >
           Skip remaining questions and analyze now &rarr;
         </button>
      )}

      {analyzing && (
        <div className="mt-4 flex justify-center text-sm font-medium text-primary animate-pulse">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing responses...
        </div>
      )}
    </div>
  );
}

/* ---- Step 2 — AI summary + manual / auto-assign ---- */

function AssignStep({
  analysis,
  facilities,
  isDistressed,
  onBack,
  onAssign,
}: {
  analysis: TriageResult & { suggested_department?: string };
  facilities: Facility[];
  isDistressed: boolean;
  onBack: () => void;
  onAssign: (a: Assignment) => void;
}) {
  const priority = isDistressed ? "critical" : getPriority(analysis.severity);
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
    
    // 1. Gather all matched doctors across all facilities
    let candidates: { f: Facility, deptName: string, deptId: string, doc: Doctor }[] = [];
    
    for (const f of facilities) {
      const matchedDept = f.departments.find((d) => d.name.toLowerCase() === dept.toLowerCase());
      if (matchedDept) {
        const docs = f.doctors.filter((d) => d.departmentId === matchedDept.id && d.available !== false);
        docs.forEach(doc => candidates.push({ f, deptName: matchedDept.name, deptId: matchedDept.id, doc }));
      }
    }

    if (candidates.length > 0) {
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      return onAssign(buildAssignment(choice.f, choice.deptName, choice.deptId, choice.doc, "auto"));
    }

    // 2. Fallback: any facility with any available doctor in General Medicine
    for (const f of facilities) {
      const general = f.departments.find((d) => /general/i.test(d.name));
      if (!general) continue;
      const doc = f.doctors.find((d) => d.departmentId === general.id && d.available !== false);
      if (doc) return onAssign(buildAssignment(f, general.name, general.id, doc, "auto"));
    }
    
    // 3. Final fallback: literally any available doctor anywhere
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
        {isDistressed && (
            <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-[11px] uppercase tracking-wider font-semibold text-destructive flex items-center gap-2 animate-pulse">
               <AlertTriangle className="h-4 w-4" />
               Kinetic Distress Detected – Priority Upgraded
            </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">AI assessment</p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}>
            {isDistressed ? "CRITICAL (OVERRIDE)" : `${m.label} · ${analysis.severity}/10`}
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
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.chip}`}
          >
            {m.label}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Room / Floor</p>
              <p className="font-medium">{assignment.room || "OPD-1"} · Ground</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-[oklch(0.55_0.15_60)]">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimated Time</p>
              <p className="font-medium">in ~15 mins</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24, delay: 0.1 }}
        className="mt-4 rounded-3xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between shadow-sm"
      >
        <div>
          <p className="text-xs uppercase tracking-wider text-primary font-bold">QR Medical Passport</p>
          <p className="text-sm font-medium mt-1">Scan at Hospital Entry</p>
          <p className="text-xs text-muted-foreground mt-1 text-primary/70 font-mono">Token: TKN-{assignment.doctorId.substring(0, 6) || "001"}</p>
        </div>
        <div className="bg-white p-1 rounded-lg border border-border shadow-sm">
           <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`nivaranai://token/${assignment.doctorId}`)}&color=000000&margin=0`}
              alt="Medical Passport QR" 
              className="h-16 w-16"
           />
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
                <p className="font-medium text-foreground text-sm">{latest.assignment.doctorName}</p>
                <p className="text-muted-foreground mb-2">
                  {latest.assignment.facilityName} · {latest.assignment.departmentName}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Room: {latest.assignment.room || "OPD-1"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> Ground Floor
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 text-warning font-medium">
                    <Clock className="h-3.5 w-3.5 text-warning" /> Estimated Wait: {Math.max(1, (position || 1)) * 5} mins (approx)
                  </div>
                </div>
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
