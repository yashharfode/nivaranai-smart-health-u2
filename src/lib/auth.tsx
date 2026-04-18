/**
 * Mock auth layer. Designed to be swapped with Firebase later
 * by replacing the implementation of signIn/signOut/signUpDoctor/signUpPatient
 * with Firebase Auth + Firestore calls.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "doctor" | "patient";
export type DoctorStatus = "pending" | "approved" | "rejected";

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface DoctorUser extends BaseUser {
  role: "doctor";
  specialty?: string;
  status: DoctorStatus;
  hospital?: { name: string; type: "Government" | "Private"; address: string };
  documents?: { degree?: string; license?: string };
}

export interface PatientUser extends BaseUser {
  role: "patient";
  age?: number;
  gender?: string;
  phone?: string;
}

export type AppUser = DoctorUser | PatientUser;

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string, role: Role) => Promise<AppUser>;
  signOut: () => void;
  signUpPatient: (data: {
    name: string;
    email: string;
    password: string;
    age?: number;
    gender?: string;
    phone?: string;
  }) => Promise<PatientUser>;
  signUpDoctor: (data: {
    name: string;
    email: string;
    password: string;
    specialty?: string;
    hospital: { name: string; type: "Government" | "Private"; address: string };
    documents: { degree?: string; license?: string };
  }) => Promise<DoctorUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "nivaran.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const persist = (u: AppUser | null) => {
    setUser(u);
    if (typeof window === "undefined") return;
    if (u) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const signIn: AuthContextValue["signIn"] = async (email, _password, role) => {
    await new Promise((r) => setTimeout(r, 600));
    const base = {
      id: crypto.randomUUID(),
      name: email.split("@")[0].replace(/\b\w/g, (c) => c.toUpperCase()),
      email,
      createdAt: new Date().toISOString(),
    };
    const u: AppUser =
      role === "doctor"
        ? { ...base, role: "doctor", status: "approved", specialty: "General Medicine" }
        : { ...base, role: "patient" };
    persist(u);
    return u;
  };

  const signUpPatient: AuthContextValue["signUpPatient"] = async (data) => {
    await new Promise((r) => setTimeout(r, 700));
    const u: PatientUser = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      role: "patient",
      age: data.age,
      gender: data.gender,
      phone: data.phone,
      createdAt: new Date().toISOString(),
    };
    persist(u);
    return u;
  };

  const signUpDoctor: AuthContextValue["signUpDoctor"] = async (data) => {
    await new Promise((r) => setTimeout(r, 800));
    const u: DoctorUser = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      role: "doctor",
      specialty: data.specialty,
      status: "pending",
      hospital: data.hospital,
      documents: data.documents,
      createdAt: new Date().toISOString(),
    };
    persist(u);
    return u;
  };

  const signOut = () => persist(null);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signUpPatient, signUpDoctor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
