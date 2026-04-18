/**
 * Hospital / Clinic / Doctor data layer.
 * localStorage-backed, structured to swap to Firestore later.
 *
 * Hierarchy: Hospital/Clinic -> Department -> Doctor
 * Clinics are constrained to a single department + single doctor.
 */

export type FacilityType = "Hospital" | "Clinic";
export type FacilityStatus = "pending" | "approved" | "rejected";

export interface Department {
  id: string;
  name: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  departmentId: string;
  facilityId: string;
  room?: string;
  available?: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  location: string;
  contact: string;
  email?: string;
  licenseFile?: string; // mock filename
  status: FacilityStatus;
  departments: Department[];
  doctors: Doctor[];
  createdAt: number;
}

export const FACILITIES_KEY = "nivaranai.facilities.v1";
const EVENT = "nivaranai:facilities";

export function loadFacilities(): Facility[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FACILITIES_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as Facility[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

export function saveFacilities(list: Facility[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FACILITIES_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: list }));
}

export function addFacility(f: Omit<Facility, "id" | "status" | "createdAt" | "doctors">) {
  const list = loadFacilities();
  const newF: Facility = {
    ...f,
    id: crypto.randomUUID(),
    status: "pending",
    doctors: [],
    createdAt: Date.now(),
  };
  saveFacilities([newF, ...list]);
  return newF;
}

export function updateFacility(id: string, patch: Partial<Facility>) {
  const list = loadFacilities().map((f) => (f.id === id ? { ...f, ...patch } : f));
  saveFacilities(list);
}

export function deleteFacility(id: string) {
  saveFacilities(loadFacilities().filter((f) => f.id !== id));
}

export function addDepartment(facilityId: string, name: string) {
  const list = loadFacilities().map((f) => {
    if (f.id !== facilityId) return f;
    if (f.type === "Clinic" && f.departments.length >= 1) return f;
    return { ...f, departments: [...f.departments, { id: crypto.randomUUID(), name }] };
  });
  saveFacilities(list);
}

export function addDoctor(
  facilityId: string,
  data: { name: string; specialty: string; departmentId: string; room?: string },
) {
  const list = loadFacilities().map((f) => {
    if (f.id !== facilityId) return f;
    if (f.type === "Clinic" && f.doctors.length >= 1) return f;
    return {
      ...f,
      doctors: [...f.doctors, { id: crypto.randomUUID(), facilityId, available: true, ...data }],
    };
  });
  saveFacilities(list);
}

export function deleteDoctor(facilityId: string, doctorId: string) {
  const list = loadFacilities().map((f) =>
    f.id === facilityId ? { ...f, doctors: f.doctors.filter((d) => d.id !== doctorId) } : f,
  );
  saveFacilities(list);
}

export function approvedFacilities(): Facility[] {
  return loadFacilities().filter((f) => f.status === "approved");
}

/**
 * Maps free-text symptoms / specialty hint to a likely department name.
 * Used as a fast fallback before/alongside AI-picked department.
 */
export const SYMPTOM_DEPARTMENT_MAP: Array<{ pattern: RegExp; department: string }> = [
  { pattern: /chest|breath|saans|seene|heart|cardiac/i, department: "Cardiology" },
  { pattern: /headache|migraine|stroke|seizure|neuro/i, department: "Neurology" },
  { pattern: /fever|throat|cold|cough|flu|bukhar/i, department: "General Medicine" },
  { pattern: /stomach|abdomen|pet|nausea|vomit|diarr/i, department: "Gastroenterology" },
  { pattern: /skin|rash|allergy|itch/i, department: "Dermatology" },
  { pattern: /bone|fracture|joint|knee|back/i, department: "Orthopedics" },
  { pattern: /child|baby|paed|pediatric/i, department: "Pediatrics" },
];

export function suggestDepartment(text: string): string {
  for (const { pattern, department } of SYMPTOM_DEPARTMENT_MAP) {
    if (pattern.test(text)) return department;
  }
  return "General Medicine";
}

function seed(): Facility[] {
  const now = Date.now();
  const hospitalId = "seed-hosp-1";
  const clinicId = "seed-clinic-1";
  const cardioId = "dept-cardio";
  const generalId = "dept-general";
  const clinicDeptId = "dept-clinic";

  const list: Facility[] = [
    {
      id: hospitalId,
      name: "Apollo City Hospital",
      type: "Hospital",
      location: "MG Road, Bengaluru",
      contact: "+91 80 4000 0000",
      status: "approved",
      createdAt: now - 1000 * 60 * 60 * 24 * 30,
      departments: [
        { id: cardioId, name: "Cardiology" },
        { id: generalId, name: "General Medicine" },
      ],
      doctors: [
        {
          id: "doc-1",
          name: "Dr. Anjali Mehta",
          specialty: "Cardiologist",
          departmentId: cardioId,
          facilityId: hospitalId,
          room: "OPD-204",
          available: true,
        },
        {
          id: "doc-2",
          name: "Dr. Rohan Iyer",
          specialty: "General Physician",
          departmentId: generalId,
          facilityId: hospitalId,
          room: "OPD-101",
          available: true,
        },
      ],
    },
    {
      id: clinicId,
      name: "Sunrise Family Clinic",
      type: "Clinic",
      location: "Koramangala, Bengaluru",
      contact: "+91 98 4500 0000",
      status: "approved",
      createdAt: now - 1000 * 60 * 60 * 24 * 10,
      departments: [{ id: clinicDeptId, name: "General Medicine" }],
      doctors: [
        {
          id: "doc-3",
          name: "Dr. Priya Nair",
          specialty: "Family Physician",
          departmentId: clinicDeptId,
          facilityId: clinicId,
          room: "Room 1",
          available: true,
        },
      ],
    },
  ];
  saveFacilities(list);
  return list;
}
