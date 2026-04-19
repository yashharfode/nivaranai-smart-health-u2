import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Loader2,
  Clock,
  FileText,
  Activity,
  CheckCircle2,
  Building2,
  Stethoscope,
  ChevronRight,
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
    
    // API KEY is taken from .env here
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

  // ✅ Here is where your code got cut last time. Now it's full.
  return (
    <div className="flex flex-col space-y-4 h-[550px]">
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "user" 
                ? "bg-primary text-primary-foreground rounded-tr-none" 
                : "bg-muted text-foreground rounded-tl-none"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-tl-none">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="pt-4 border-t border-border flex flex-col gap-3">
        {recording && (
          <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl animate-pulse">
            <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
            <span className="text-xs font-medium text-primary">Listening: {interim || "..."}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={displayDraft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
              disabled={analyzing}
              placeholder={recording ? "Listening..." : "Type your symptoms..."}
              className="w-full bg-muted/50 border-none rounded-2xl py-3 px-4 pr-12 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
            />
            <button 
              onClick={recording ? stopRecording : startRecording}
              disabled={starting || analyzing}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors ${
                recording ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>
          
          <button
            onClick={handleSend}
            disabled={!displayDraft.trim() || analyzing || isTyping}
            className="h-11 w-11 flex items-center justify-center rounded-2xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
          >
            {analyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] text-muted-foreground">
            {messages.filter(m => m.role === "user").length}/6 questions answered
          </p>
          <button 
            onClick={handleFinishEarly}
            disabled={messages.filter(m => m.role === "user").length === 0 || analyzing}
            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
          >
            Analyze Now <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Step 2 — AI Analysis & Doctor Match ---- */

function AssignStep({
  analysis,
  isDistressed,
  facilities,
  onBack,
  onAssign,
}: {
  analysis: TriageResult & { suggested_department?: string };
  isDistressed: boolean;
  facilities: Facility[];
  onBack: () => void;
  onAssign: (a: Assignment) => void;
}) {
  const prio = getPriority(analysis.severity);
  const meta = priorityMeta[isDistressed ? "critical" : prio];
  const PrioIcon = meta.icon;

  const getBestDoctors = () => {
    let matches: { doctor: Doctor; facility: Facility; matchScore: number }[] = [];
    facilities.forEach((f) => {
      f.departments.forEach((d) => {
        if (d.name === analysis.suggested_department) {
          d.doctors.forEach((doc) => {
            if (doc.status === "available") {
              matches.push({ doctor: doc, facility: f, matchScore: 100 });
            }
          });
        }
      });
    });
    if (matches.length === 0) {
      facilities.forEach((f) => {
        f.departments.forEach((d) => {
          d.doctors.forEach((doc) => {
            if (doc.status === "available") {
              matches.push({ doctor: doc, facility: f, matchScore: 50 });
            }
          });
        });
      });
    }
    return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
  };
  const bestDoctors = getBestDoctors();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className={`p-4 border-b border-border flex items-center gap-3 ${meta.color} bg-opacity-10`}>
           <div className={`p-2 rounded-xl bg-background shadow-sm ${meta.color}`}>
             <PrioIcon className="h-5 w-5" />
           </div>
           <div>
             <h3 className="font-semibold text-foreground">AI Assessment Complete</h3>
             <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {meta.label} Priority ({analysis.severity}/10)
             </p>
           </div>
        </div>
        <div className="p-5 space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Symptoms</p>
                 <p className="text-sm font-medium text-foreground">{analysis.main_symptom}</p>
              </div>
              <div className="space-y-1">
                 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</p>
                 <p className="text-sm font-medium text-foreground">{analysis.suggested_department || "General"}</p>
              </div>
           </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
           <Stethoscope className="h-4 w-4 text-primary" /> Recommended Doctors
        </h4>
        <div className="space-y-3">
          {bestDoctors.length > 0 ? (
            bestDoctors.map((m) => (
              <div
                key={m.doctor.id}
                onClick={() => onAssign({ doctorId: m.doctor.id, facilityId: m.facility.id, departmentName: analysis.suggested_department || "General", assignedAt: Date.now() })}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {m.doctor.name.charAt(0)}
                   </div>
                   <div>
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{m.doctor.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {m.facility.name}
                      </p>
                   </div>
                </div>
                <button className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Select
                </button>
              </div>
            ))
          ) : (
             <div className="text-center p-6 border border-border rounded-2xl text-muted-foreground text-sm">
                No available doctors right now. Please try again later.
             </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 text-sm font-medium text-foreground border border-border rounded-xl hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---- Step 3 — Success ---- */

function SuccessStep({
  assignment,
  severity,
  onAgain,
}: {
  assignment: Assignment;
  severity: number;
  onAgain: () => void;
}) {
  const prio = getPriority(severity);
  const meta = priorityMeta[prio];

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
      <div className="relative">
         <div className="absolute inset-0 rounded-full bg-success/20 animate-ping" />
         <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success text-primary-foreground shadow-xl">
           <CheckCircle2 className="h-10 w-10" />
         </div>
      </div>
      <div className="space-y-2">
         <h3 className="text-2xl font-bold text-foreground tracking-tight">Request Sent!</h3>
         <p className="text-muted-foreground max-w-xs mx-auto">
           Your details have been securely sent to the selected facility.
         </p>
      </div>
      
      <div className="w-full max-w-sm rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
         <div className="flex justify-between items-center pb-4 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Priority Level</span>
            <span className={`text-sm font-bold ${meta.color} flex items-center gap-1`}>
               {meta.label}
            </span>
         </div>
         <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Next Step</span>
            <span className="text-sm font-medium text-foreground">Wait for facility call</span>
         </div>
      </div>

      <button
        onClick={onAgain}
        className="w-full max-w-sm py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl shadow-md hover:opacity-90 transition-opacity"
      >
        Submit Another Record
      </button>
    </div>
  );
}

/* ============================================================
   Side Cards
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
  if (!latest) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft flex flex-col items-center justify-center text-center h-full min-h-[250px] space-y-3">
         <div className="p-3 bg-muted rounded-2xl">
            <Activity className="h-6 w-6 text-muted-foreground" />
         </div>
         <div>
            <h3 className="font-semibold text-foreground">No Active Requests</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
               Submit your symptoms using the wizard to see your status here.
            </p>
         </div>
      </div>
    );
  }

  const meta = priorityMeta[latest.priority];
  const Icon = meta.icon;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft flex flex-col justify-between">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-foreground tracking-tight">Current Status</h3>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
           <Clock className="h-3.5 w-3.5" /> Updated just now
        </p>
      </div>

      <div className="my-6 flex flex-col items-center justify-center space-y-2">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5">
           <span className="text-4xl font-black text-primary tracking-tighter">{position}</span>
           <div className="absolute -bottom-2 -right-2 bg-card rounded-full p-1 border border-border shadow-sm">
             <Icon className={`h-5 w-5 ${meta.color}`} />
           </div>
        </div>
        <p className="text-sm font-medium text-foreground">Your position in queue</p>
      </div>

      <div className="space-y-3 rounded-2xl bg-muted/40 p-4 border border-border/50">
        <div className="flex justify-between items-center text-sm">
           <span className="text-muted-foreground">Severity Score</span>
           <span className="font-semibold text-foreground">{latest.severity}/10</span>
        </div>
        <div className="flex justify-between items-center text-sm">
           <span className="text-muted-foreground">Total Waiting</span>
           <span className="font-medium text-foreground">{totalWaiting} patients</span>
        </div>
        <div className="flex justify-between items-center text-sm">
           <span className="text-muted-foreground">Department</span>
           <span className="font-medium text-foreground">{latest.suggested_department || "General"}</span>
        </div>
      </div>
    </div>
  );
}

function SubmissionsCard({ records }: { records: PatientRecord[] }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft flex flex-col h-full max-h-[500px]">
      <div className="flex items-center justify-between mb-4">
         <h3 className="text-lg font-bold text-foreground tracking-tight">Recent Submissions</h3>
         <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
            {records.length}
         </span>
      </div>
      
      {records.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2">
           <FileText className="h-8 w-8 text-muted-foreground/50" />
           <p className="text-sm text-muted-foreground">No previous records found.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
          {records.map((r) => {
            const meta = priorityMeta[r.priority];
            const date = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <div key={r.id} className="group p-3 rounded-2xl border border-border bg-background hover:border-primary/30 transition-colors flex flex-col gap-2 cursor-default">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-current ${meta.color}`} />
                      <span className="text-xs font-semibold text-foreground">{r.main_symptom || "Checkup"}</span>
                   </div>
                   <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">{date}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                   <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.location || "N/A"}</span>
                   <span className={`capitalize font-medium ${r.status === 'resolved' ? 'text-success' : 'text-primary'}`}>
                     {r.status}
                   </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
