/**
 * Hospital onboarding + credentials layer (localStorage).
 * - Application IDs: HOSP-YYYY-XXXX
 * - Auto-generated login credentials on admin approval
 * - Doctor email registry (used to gate doctor logins)
 */

const APPS_KEY = "nivaranai.hospitalApps.v1";
const CREDS_KEY = "nivaranai.hospitalCreds.v1";
const DOCTOR_EMAILS_KEY = "nivaranai.doctorEmails.v1";
const APPS_EVENT = "nivaranai:hospitalApps";
const CREDS_EVENT = "nivaranai:hospitalCreds";
const DOCTOR_EMAILS_EVENT = "nivaranai:doctorEmails";

export interface HospitalCredentials {
  facilityId: string;
  applicationId: string;
  username: string;
  password: string;
  createdAt: number;
}

/* ------------- Application ID ------------- */

export function generateApplicationId(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(1000 + Math.random() * 9000);
  return `HOSP-${year}-${num}`;
}

/* ------------- Application registry (facilityId ↔ applicationId) ------------- */

interface AppEntry {
  applicationId: string;
  facilityId: string;
  email: string;
  createdAt: number;
}

export function loadApplications(): AppEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(APPS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveApplication(entry: AppEntry) {
  const list = loadApplications();
  const next = [entry, ...list.filter((a) => a.facilityId !== entry.facilityId)];
  window.localStorage.setItem(APPS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(APPS_EVENT, { detail: next }));
}

export function findApplicationByFacility(facilityId: string): AppEntry | undefined {
  return loadApplications().find((a) => a.facilityId === facilityId);
}

/* ------------- Credentials ------------- */

export function loadCredentials(): HospitalCredentials[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CREDS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCredentials(list: HospitalCredentials[]) {
  window.localStorage.setItem(CREDS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CREDS_EVENT, { detail: list }));
}

export function generateCredentials(
  facilityName: string,
  facilityId: string,
  applicationId: string,
): HospitalCredentials {
  const slug =
    facilityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "hospital";
  const username = `${slug}${Math.floor(100 + Math.random() * 900)}`;
  // Memorable but secure-looking password
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  let password = "";
  for (let i = 0; i < 12; i++) password += chars[Math.floor(Math.random() * chars.length)];
  password += "!" + Math.floor(10 + Math.random() * 90);
  const cred: HospitalCredentials = {
    facilityId,
    applicationId,
    username,
    password,
    createdAt: Date.now(),
  };
  const list = loadCredentials();
  saveCredentials([cred, ...list.filter((c) => c.facilityId !== facilityId)]);
  return cred;
}

export function findCredentialsByFacility(facilityId: string): HospitalCredentials | undefined {
  return loadCredentials().find((c) => c.facilityId === facilityId);
}

export function verifyHospitalLogin(
  username: string,
  password: string,
): HospitalCredentials | null {
  const c = loadCredentials().find(
    (x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password,
  );
  return c ?? null;
}

/* ------------- Hospital session ------------- */

const SESSION_KEY = "nivaranai.hospitalSession.v1";

export function setHospitalSession(facilityId: string) {
  window.localStorage.setItem(SESSION_KEY, facilityId);
}

export function getHospitalSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function clearHospitalSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

/* ------------- Doctor email registry (gate for doctor login) ------------- */

export function loadDoctorEmails(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DOCTOR_EMAILS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function registerDoctorEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const list = loadDoctorEmails();
  if (list.includes(e)) return;
  const next = [e, ...list];
  window.localStorage.setItem(DOCTOR_EMAILS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DOCTOR_EMAILS_EVENT, { detail: next }));
}

export function isDoctorEmailRegistered(email: string): boolean {
  return loadDoctorEmails().includes(email.trim().toLowerCase());
}
