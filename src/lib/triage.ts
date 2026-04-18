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

export interface Assignment {
  facilityId: string;
  facilityName: string;
  facilityType: "Hospital" | "Clinic";
  departmentId: string;
  departmentName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  room?: string;
  mode: "manual" | "auto";
}

export type PatientStatus = "pending" | "accepted" | "in_consult" | "completed" | "rejected";

export interface PatientHistoryEntry {
  id: string;
  timestamp: number;
  main_symptom: string;
  severity: number;
}

export interface PatientRecord extends TriageResult {
  id: string;
  patient_name: string;
  patient_age?: number;
  patient_gender?: string;
  transcript: string;
  priority: Priority;
  timestamp: number;
  status?: PatientStatus;
  assignment?: Assignment;
  suggested_department?: string;
  /** Mock pre-existing condition flag (e.g. "Diabetes", "Hypertension"). */
  pre_existing?: string;
  /** Past visits for the same patient name (populated on creation). */
  history?: PatientHistoryEntry[];
  /** Whether the doctor has sent a prescription. */
  prescription_sent?: boolean;
}

export function getPriority(severity: number): Priority {
  if (severity >= 8) return "critical";
  if (severity >= 5) return "urgent";
  return "normal";
}

export const statusMeta: Record<PatientStatus, { label: string; chip: string }> = {
  pending: { label: "Pending", chip: "bg-muted text-foreground border-border" },
  accepted: { label: "Accepted", chip: "bg-primary/10 text-primary border-primary/20" },
  in_consult: {
    label: "In Consultation",
    chip: "bg-warning/15 text-[oklch(0.45_0.12_60)] border-warning/30",
  },
  completed: { label: "Completed", chip: "bg-success/15 text-success border-success/30" },
  rejected: { label: "Rejected", chip: "bg-destructive/10 text-destructive border-destructive/20" },
};

export const priorityMeta: Record<
  Priority,
  { label: string; dot: string; chip: string; ring: string; rank: number }
> = {
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

export const PATIENTS_KEY = "nivaranai.patients.v1";

export function loadPatients(): PatientRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PATIENTS_KEY);
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
  window.localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients));
  // Notify same-tab subscribers (storage event only fires across tabs)
  window.dispatchEvent(new CustomEvent("nivaranai:patients", { detail: patients }));
}

export function addPatient(rec: PatientRecord) {
  const list = loadPatients();
  // Attach prior visits for this patient (by name) as history.
  const prior = list
    .filter((p) => p.patient_name.toLowerCase() === rec.patient_name.toLowerCase())
    .slice(0, 8)
    .map<PatientHistoryEntry>((p) => ({
      id: p.id,
      timestamp: p.timestamp,
      main_symptom: p.main_symptom,
      severity: p.severity,
    }));
  const enriched: PatientRecord = { ...rec, history: prior };
  const next = [enriched, ...list];
  savePatients(next);
  return next;
}

export function updatePatient(id: string, patch: Partial<PatientRecord>) {
  const next = loadPatients().map((p) => (p.id === id ? { ...p, ...patch } : p));
  savePatients(next);
  return next;
}

export function sortByPriority(patients: PatientRecord[]) {
  return [...patients].sort((a, b) => {
    const r = priorityMeta[a.priority].rank - priorityMeta[b.priority].rank;
    if (r !== 0) return r;
    return b.timestamp - a.timestamp;
  });
}

export async function analyzeTranscript(
  transcript: string,
  availableDepartments?: string[],
): Promise<TriageResult & { suggested_department?: string }> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, availableDepartments }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Analyze failed (${res.status})`);
  }
  return await res.json();
}

function seedPatients(): PatientRecord[] {
  const now = Date.now();
  const seed: PatientRecord[] = [
    {
      id: "seed-1",
      patient_name: "Priya Nair",
      patient_age: 28,
      transcript: "I have had a fever and sore throat for two days.",
      main_symptom: "Fever with sore throat",
      duration: "2 days",
      severity: 4,
      priority: "normal",
      status: "pending",
      timestamp: now - 1000 * 60 * 14,
      soap: {
        subjective:
          "Fever ~100°F with sore throat for 2 days. Mild difficulty swallowing, no body ache.",
        objective: "Awaiting examination.",
        assessment: "Likely viral pharyngitis.",
        plan: "Paracetamol PRN, saline gargles, hydration. Review in 3 days.",
      },
      assignment: {
        facilityId: "seed-hosp-1",
        facilityName: "Apollo City Hospital",
        facilityType: "Hospital",
        departmentId: "dept-general",
        departmentName: "General Medicine",
        doctorId: "doc-2",
        doctorName: "Dr. Rohan Iyer",
        doctorSpecialty: "General Physician",
        room: "OPD-101",
        mode: "auto",
      },
    },
    {
      id: "seed-2",
      patient_name: "Ramesh Kumar",
      patient_age: 56,
      transcript: "Severe headache and my BP feels very high since morning.",
      main_symptom: "Severe headache with high BP",
      duration: "Since morning",
      severity: 7,
      priority: "urgent",
      status: "pending",
      pre_existing: "Hypertension",
      timestamp: now - 1000 * 60 * 8,
      soap: {
        subjective: "Severe throbbing headache since morning. Known hypertensive.",
        objective: "Awaiting BP, neuro exam.",
        assessment: "Possible hypertensive urgency. Rule out secondary causes.",
        plan: "Check BP, neuro exam, ECG. Antihypertensive titration. Review in 1 hour.",
      },
      assignment: {
        facilityId: "seed-hosp-1",
        facilityName: "Apollo City Hospital",
        facilityType: "Hospital",
        departmentId: "dept-cardio",
        departmentName: "Cardiology",
        doctorId: "doc-1",
        doctorName: "Dr. Anjali Mehta",
        doctorSpecialty: "Cardiologist",
        room: "OPD-204",
        mode: "auto",
      },
    },
  ];
  savePatients(seed);
  return seed;
}
