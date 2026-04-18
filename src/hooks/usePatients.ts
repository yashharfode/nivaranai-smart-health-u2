import { useEffect, useState } from "react";
import { loadPatients, PATIENTS_KEY, sortByPriority, type PatientRecord } from "@/lib/triage";

/**
 * Subscribe to the shared patient queue (localStorage).
 * Updates live across tabs (storage event) and within the same tab
 * via a custom "nivaranai:patients" event dispatched by savePatients().
 */
export function usePatients(): PatientRecord[] {
  const [patients, setPatients] = useState<PatientRecord[]>([]);

  useEffect(() => {
    setPatients(loadPatients());

    const refresh = () => setPatients(loadPatients());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<PatientRecord[]>).detail;
      if (Array.isArray(detail)) setPatients(detail);
      else refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === PATIENTS_KEY) refresh();
    };

    window.addEventListener("nivaranai:patients", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nivaranai:patients", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return sortByPriority(patients);
}
