import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Lock,
  Check,
  X,
  Trash2,
  Plus,
  Building2,
  Stethoscope,
  ShieldCheck,
  Search,
  Copy,
  KeyRound,
  Map,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useFacilities } from "@/hooks/useFacilities";
import { usePatients } from "@/hooks/usePatients";
import {
  addDepartment,
  addDoctor,
  deleteDoctor,
  deleteFacility,
  updateFacility,
  type Facility,
} from "@/lib/hospitals";
import {
  findApplicationByFacility,
  findCredentialsByFacility,
  generateCredentials,
  registerDoctorEmail,
  type HospitalCredentials,
} from "@/lib/hospitalAuth";
import { decryptVault } from "@/lib/triage";

const ADMIN_PASSWORD = "nivaran2025";

export const Route = createFileRoute("/admin-secret")({
  head: () => ({ meta: [{ title: "Admin — NivaranAI" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");

  if (!authed) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto flex max-w-7xl items-center justify-center px-5 py-16 sm:px-8 sm:py-24">
          <div className="w-full max-w-md">
            <div className="text-center">
              <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">
                System Override
              </p>
              <div className="mt-2 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-soft">
                  <Lock className="h-5 w-5" />
                </div>
              </div>
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
                Admin Access
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Restricted area. Authorized personnel only.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pw === ADMIN_PASSWORD) setAuthed(true);
                else toast.error("Incorrect password");
              }}
              className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8"
            >
              <label className="block text-xs font-medium text-muted-foreground">
                Master Password
              </label>
              <input
                type="password"
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="submit"
                className="mt-6 w-full rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-all hover:bg-mineral"
              >
                Authenticate
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const facilities = useFacilities();
  const allPatients = usePatients();
  const [query, setQuery] = useState("");
  const [credModal, setCredModal] = useState<{
    cred: HospitalCredentials;
    facilityName: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return facilities;
    return facilities.filter((f) => {
      const app = findApplicationByFacility(f.id);
      return (
        f.name.toLowerCase().includes(q) ||
        f.email?.toLowerCase().includes(q) ||
        app?.applicationId.toLowerCase().includes(q)
      );
    });
  }, [facilities, query]);

  const pending = filtered.filter((f) => f.status === "pending");
  const approved = filtered.filter((f) => f.status === "approved");
  const rejected = filtered.filter((f) => f.status === "rejected");

  const handleApprove = (f: Facility) => {
    const app = findApplicationByFacility(f.id);
    const appId = app?.applicationId ?? `HOSP-${new Date().getFullYear()}-0000`;
    const cred = generateCredentials(f.name, f.id, appId);
    updateFacility(f.id, { status: "approved" });
    setCredModal({ cred, facilityName: f.name });
    toast.success("Hospital Approved ✅");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Admin
            </div>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Facility management
            </h1>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Home
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total Hospitals" value={approved.length} />
          <Stat label="Pending Approvals" value={pending.length} />
          <Stat label="Active Doctors" value={approved.reduce((acc, f) => acc + f.doctors.length, 0)} />
          <Stat label="Total Patients" value={allPatients.length} />
        </div>

        <EpidemicRadar allPatients={allPatients} />

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Application ID, hospital name, or email…"
            className="w-full rounded-2xl border border-border bg-card py-3 pl-11 pr-4 text-sm outline-none focus:border-foreground"
          />
        </div>

        <Section title="Pending review" facilities={pending} onApprove={handleApprove} />
        <Section title="Approved" facilities={approved} onApprove={handleApprove} />
        {rejected.length > 0 && (
          <Section title="Rejected" facilities={rejected} onApprove={handleApprove} />
        )}
      </main>

      {credModal && <CredentialsModal {...credModal} onClose={() => setCredModal(null)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function EpidemicRadar({ allPatients }: { allPatients: any[] }) {
  // Group by location AND primary symptom category
  const clusters = allPatients.reduce((acc, p) => {
    let loc = p.location || "Bhopal";
    const pincodeMatch = String(loc).match(/\b\d{6}\b/);
    if (pincodeMatch) loc = pincodeMatch[0]; // strictly apply 6-digit pin code
    
    const title = p.main_symptom?.toLowerCase() || "";
    const symptom = title.includes("fever") ? "Fever" : 
                    title.includes("cough") ? "Respiratory" : null;
    if (symptom) {
       const key = `${loc}|${symptom}`;
       if (!acc[key]) acc[key] = [];
       acc[key].push(p);
    }
    return acc;
  }, {} as Record<string, any[]>);

  // Find outbreaks (threshold 5+)
  const outbreaks = Object.entries(clusters)
    .filter(([_, patients]: [string, any]) => patients.length >= 5) 
    .map(([key, patients]: [string, any]) => {
      const [loc, symptom] = key.split("|");
      return { loc, symptom, count: patients.length, patients };
    });

  if (outbreaks.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 shadow-soft animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 text-destructive mb-3">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="font-display font-semibold tracking-tight">AI Epidemic Radar</h3>
      </div>

      {/* Epidemic Heatmap Visualization Grid */}
      <div className="mb-5 p-4 bg-background rounded-xl border border-destructive/20 relative overflow-hidden shadow-inner">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-destructive/10 to-transparent pointer-events-none"></div>
         <div className="flex items-center justify-between mb-3 relative z-10">
           <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Live Pincode Heatmap</p>
           <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-destructive animate-pulse">
             <span className="h-2 w-2 rounded-full bg-destructive"></span> Live Tracking
           </span>
         </div>
         <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 relative z-10">
            {Array.from(new Set(["462001", "462002", "462003", "462016", "462021", "462022", "462023", "462024", ...outbreaks.map(o => o.loc)])).slice(0, 10).map((zone) => {
               const outbreak = outbreaks.find(o => o.loc === zone);
               return (
                  <div key={zone} className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-mono border transition-all ${
                     outbreak ? 'bg-destructive text-destructive-foreground border-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse scale-105 z-10' : 'bg-secondary/40 text-muted-foreground border-border/50 opacity-60'
                  }`}>
                    <span className="font-bold">{zone}</span>
                    {outbreak ? (
                       <span className="mt-1 bg-background text-destructive px-1.5 py-0.5 rounded-full text-[10px] shadow-sm">{outbreak.count} {outbreak.symptom}</span>
                    ) : (
                       <span className="mt-1 text-[9px] opacity-40">Clear</span>
                    )}
                  </div>
               )
            })}
         </div>
      </div>

      <div className="flex flex-col gap-4">
         {outbreaks.map((ob, idx) => (
            <div key={idx} className="flex flex-col gap-3 bg-background border border-destructive/30 p-4 rounded-xl shadow-sm">
               <div className="flex items-center gap-3">
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                   <Map className="h-5 w-5" />
                 </div>
                 <div>
                    <p className="text-sm font-semibold text-destructive">🚨 Possible outbreak detected</p>
                    <p className="text-xs text-muted-foreground">{ob.symptom} cases increasing in {ob.loc} ({ob.count} recent cases)</p>
                 </div>
               </div>
               
               <div className="mt-2 rounded-lg border border-border/50 divide-y divide-border/50 bg-secondary/10">
                 <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-secondary/30 rounded-t-lg">
                   Patient Details & Contact Tracing
                 </div>
                 {ob.patients.map((p: any, pIdx: number) => (
                   <div key={pIdx} className="px-3 py-2 text-xs flex justify-between items-center">
                     <div>
                       <span className="font-medium text-foreground">{decryptVault(p.patient_name)}</span>
                       <span className="ml-2 text-muted-foreground">Age: {p.patient_age}</span>
                     </div>
                     <span className="tabular-nums font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                       {p.patient_phone || "No phone"}
                     </span>
                   </div>
                 ))}
               </div>
            </div>
         ))}
      </div>
    </div>
  )
}

function Section({
  title,
  facilities,
  onApprove,
}: {
  title: string;
  facilities: Facility[];
  onApprove: (f: Facility) => void;
}) {
  if (facilities.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">
        {facilities.map((f) => (
          <FacilityCard key={f.id} facility={f} onApprove={onApprove} />
        ))}
      </div>
    </section>
  );
}

function FacilityCard({
  facility,
  onApprove,
}: {
  facility: Facility;
  onApprove: (f: Facility) => void;
}) {
  const [open, setOpen] = useState(facility.status === "pending");
  const Icon = facility.type === "Hospital" ? Building2 : Stethoscope;
  const app = findApplicationByFacility(facility.id);
  const cred = findCredentialsByFacility(facility.id);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold">{facility.name}</h3>
              <StatusChip status={facility.status} />
              {app && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  {app.applicationId}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {facility.type} · {facility.location} · {facility.contact}
            </p>
            {facility.email && <p className="text-xs text-muted-foreground">📧 {facility.email}</p>}
            {facility.licenseFile && (
              <p className="mt-1 text-xs text-foreground/70">📎 {facility.licenseFile}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {facility.status === "pending" && (
            <>
              <button
                onClick={() => onApprove(facility)}
                className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </button>
              <button
                onClick={() => {
                  updateFacility(facility.id, { status: "rejected" });
                  toast.message(`${facility.name} rejected`);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" /> Reject
              </button>
            </>
          )}
          {cred && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
              <KeyRound className="h-3 w-3" /> Credentials issued
            </span>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
          >
            {open ? "Hide" : "Manage"}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${facility.name}?`)) {
                deleteFacility(facility.id);
                toast.message("Deleted");
              }
            }}
            className="rounded-full border border-destructive/30 bg-background px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && <ManagePanel facility={facility} />}
    </div>
  );
}

function StatusChip({ status }: { status: Facility["status"] }) {
  const map = {
    pending: "bg-warning/15 text-[oklch(0.45_0.12_60)] border-warning/30",
    approved: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  } as const;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${map[status]}`}
    >
      {status}
    </span>
  );
}

function ManagePanel({ facility }: { facility: Facility }) {
  const [deptName, setDeptName] = useState("");
  const [doc, setDoc] = useState({
    name: "",
    specialty: "",
    departmentId: "",
    room: "",
    email: "",
  });
  const isClinic = facility.type === "Clinic";
  const clinicLockedDept = isClinic && facility.departments.length >= 1;
  const clinicLockedDoc = isClinic && facility.doctors.length >= 1;

  return (
    <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Departments
        </h4>
        <div className="mt-2 space-y-1.5">
          {facility.departments.map((d) => (
            <div
              key={d.id}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              {d.name}
            </div>
          ))}
          {facility.departments.length === 0 && (
            <p className="text-xs text-muted-foreground">No departments yet.</p>
          )}
        </div>
        {!clinicLockedDept && (
          <div className="mt-2 flex gap-2">
            <input
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="Department name"
              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground"
            />
            <button
              onClick={() => {
                if (!deptName.trim()) return;
                addDepartment(facility.id, deptName.trim());
                setDeptName("");
              }}
              className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-mineral"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Doctors
        </h4>
        <div className="mt-2 space-y-1.5">
          {facility.doctors.map((d) => {
            const dept = facility.departments.find((x) => x.id === d.departmentId);
            return (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.specialty} · {dept?.name ?? "—"} · {d.room ?? "—"}
                  </div>
                </div>
                <button
                  onClick={() => deleteDoctor(facility.id, d.id)}
                  className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {facility.doctors.length === 0 && (
            <p className="text-xs text-muted-foreground">No doctors yet.</p>
          )}
        </div>
        {!clinicLockedDoc && facility.departments.length > 0 && (
          <div className="mt-2 grid gap-1.5">
            <input
              value={doc.name}
              onChange={(e) => setDoc({ ...doc, name: e.target.value })}
              placeholder="Dr. Name"
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={doc.specialty}
                onChange={(e) => setDoc({ ...doc, specialty: e.target.value })}
                placeholder="Specialty"
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground"
              />
              <input
                value={doc.room}
                onChange={(e) => setDoc({ ...doc, room: e.target.value })}
                placeholder="Room"
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground"
              />
            </div>
            <input
              type="email"
              value={doc.email}
              onChange={(e) => setDoc({ ...doc, email: e.target.value })}
              placeholder="Doctor email (required)"
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground"
            />
            <select
              value={doc.departmentId}
              onChange={(e) => setDoc({ ...doc, departmentId: e.target.value })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground"
            >
              <option value="">Select department</option>
              {facility.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (
                  !doc.name.trim() ||
                  !doc.specialty.trim() ||
                  !doc.departmentId ||
                  !doc.email.trim()
                ) {
                  toast.error("Name, specialty, department, and email required.");
                  return;
                }
                addDoctor(facility.id, {
                  name: doc.name.trim(),
                  specialty: doc.specialty.trim(),
                  departmentId: doc.departmentId,
                  room: doc.room.trim() || undefined,
                });
                registerDoctorEmail(doc.email.trim());
                setDoc({ name: "", specialty: "", departmentId: "", room: "", email: "" });
                toast.success("Doctor added");
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-mineral"
            >
              <Plus className="h-3.5 w-3.5" /> Add doctor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CredentialsModal({
  cred,
  facilityName,
  onClose,
}: {
  cred: HospitalCredentials;
  facilityName: string;
  onClose: () => void;
}) {
  const copy = (val: string, label: string) => {
    navigator.clipboard?.writeText(val);
    toast.success(`${label} copied`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-elevated">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/15 text-success">
              <Check className="h-5 w-5" />
            </div>
            <h2 className="font-display mt-3 text-xl font-semibold">Hospital Approved ✅</h2>
            <p className="mt-1 text-sm text-muted-foreground">{facilityName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wider text-primary">Generated credentials</p>

          <div className="mt-3 space-y-2">
            <CredRow
              label="Username"
              value={cred.username}
              onCopy={() => copy(cred.username, "Username")}
            />
            <CredRow
              label="Password"
              value={cred.password}
              onCopy={() => copy(cred.password, "Password")}
              mono
            />
            <CredRow
              label="Application ID"
              value={cred.applicationId}
              onCopy={() => copy(cred.applicationId, "Application ID")}
              mono
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-warning/10 p-3 text-xs text-foreground/80">
          ⚠️ Please share these credentials with the hospital via email. They will not be shown
          again.
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:bg-mineral"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function CredRow({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
      <button
        onClick={onCopy}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
