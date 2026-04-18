export type Priority = "critical" | "urgent" | "normal";

export interface TriageResult {
  main_symptom: string;
  duration: string;
  severity: number;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  source?: "ai" | "fallback";
}

export interface PatientRecord extends TriageResult {
  id: string;
  patient_name: string;
  transcript: string;
  priority: Priority;
  timestamp: number;
}

export function getPriority(severity: number): Priority {
  if (severity >= 8) return "critical";
  if (severity >= 5) return "urgent";
  return "normal";
}

export const priorityMeta: Record<Priority, { label: string; dot: string; chip: string; ring: string; rank: number }> = {
  critical: {
    label: "CRITICAL",
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive border-destructive/20",
    ring: "ring-destructive/30",
    rank: 0,
  },
  urgent: {
    label: "URGENT",
    dot: "bg-warning",
    chip: "bg-warning/15 text-[oklch(0.45_0.12_60)] border-warning/30",
    ring: "ring-warning/30",
    rank: 1,
  },
  normal: {
    label: "NORMAL",
    dot: "bg-success",
    chip: "bg-success/15 text-success border-success/30",
    ring: "ring-success/20",
    rank: 2,
  },
};

const KEY = "nivaranai.patients.v1";

export function loadPatients(): PatientRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seedPatients();
    const parsed = JSON.parse(raw) as PatientRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedPatients();
    return parsed;
  } catch {
    return seedPatients();
  }
}

export function savePatients(patients: PatientRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(patients));
}

function seedPatients(): PatientRecord[] {
  const now = Date.now();
  const seed: PatientRecord[] = [
    {
      id: "seed-1",
      patient_name: "Priya Nair",
      transcript: "I have had a fever and sore throat for two days.",
      main_symptom: "Fever with sore throat",
      duration: "2 days",
      severity: 4,
      priority: "normal",
      timestamp: now - 1000 * 60 * 14,
      soap: {
        subjective: "Fever ~100°F with sore throat for 2 days. Mild difficulty swallowing, no body ache.",
        objective: "Awaiting examination.",
        assessment: "Likely viral pharyngitis.",
        plan: "Paracetamol PRN, saline gargles, hydration. Review in 3 days.",
      },
    },
    {
      id: "seed-2",
      patient_name: "Ramesh Kumar",
      transcript: "Severe headache and my BP feels very high since morning.",
      main_symptom: "Severe headache with high BP",
      duration: "Since morning",
      severity: 7,
      priority: "urgent",
      timestamp: now - 1000 * 60 * 8,
      soap: {
        subjective: "Severe throbbing headache since morning. Known hypertensive.",
        objective: "Awaiting BP, neuro exam.",
        assessment: "Possible hypertensive urgency. Rule out secondary causes.",
        plan: "Check BP, neuro exam, ECG. Antihypertensive titration. Review in 1 hour.",
      },
    },
  ];
  savePatients(seed);
  return seed;
}
