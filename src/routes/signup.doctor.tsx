import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowLeft, Check, Loader2, Upload } from "lucide-react";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup/doctor")({
  head: () => ({
    meta: [{ title: "Doctor signup — NivaranAI" }],
  }),
  component: DoctorSignup,
});

type Form = {
  name: string;
  email: string;
  password: string;
  specialty: string;
  degreeFile: string;
  licenseFile: string;
  hospitalName: string;
  hospitalType: "Government" | "Private";
  hospitalAddress: string;
};

const STEPS = ["Basic info", "Documents", "Hospital", "Review"] as const;

function DoctorSignup() {
  const { signUpDoctor } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    name: "",
    email: "",
    password: "",
    specialty: "",
    degreeFile: "",
    licenseFile: "",
    hospitalName: "",
    hospitalType: "Private",
    hospitalAddress: "",
  });

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signUpDoctor({
        name: form.name,
        email: form.email,
        password: form.password,
        specialty: form.specialty,
        hospital: { name: form.hospitalName, type: form.hospitalType, address: form.hospitalAddress },
        documents: { degree: form.degreeFile, license: form.licenseFile },
      });
      navigate({ to: "/dashboard/doctor" });
    } catch {
      setError("Could not submit your application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
        <div className="text-center">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Doctor signup</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Join NivaranAI</h1>
          <p className="mt-2 text-sm text-muted-foreground">Verified clinicians only. Approval typically within 48 hours.</p>
        </div>

        <Stepper current={step} />

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Full name" value={form.name} onChange={(v) => update("name", v)} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} />
              <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} />
              <Field label="Specialty" placeholder="e.g. General Medicine" value={form.specialty} onChange={(v) => update("specialty", v)} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <FileField
                label="Degree certificate"
                file={form.degreeFile}
                onFile={(name) => update("degreeFile", name)}
              />
              <FileField
                label="Medical license"
                file={form.licenseFile}
                onFile={(name) => update("licenseFile", name)}
              />
              <p className="text-xs text-muted-foreground">
                Files are not uploaded yet — this is a UI preview. Once Firebase is connected, uploads will go to secure storage.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field label="Hospital name" value={form.hospitalName} onChange={(v) => update("hospitalName", v)} />
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Hospital type</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["Government", "Private"] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => update("hospitalType", t)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                        form.hospitalType === t
                          ? "border-primary bg-primary/10 text-mineral"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Address" value={form.hospitalAddress} onChange={(v) => update("hospitalAddress", v)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <ReviewRow label="Name" value={form.name} />
              <ReviewRow label="Email" value={form.email} />
              <ReviewRow label="Specialty" value={form.specialty || "—"} />
              <ReviewRow label="Degree" value={form.degreeFile || "—"} />
              <ReviewRow label="License" value={form.licenseFile || "—"} />
              <ReviewRow label="Hospital" value={`${form.hospitalName} (${form.hospitalType})`} />
              <ReviewRow label="Address" value={form.hospitalAddress} />
              <div className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
                After submission your status will be <span className="font-semibold text-foreground">Pending</span>.
                You'll get full access once approved.
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-mineral"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-mineral disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit application <Check className="h-4 w-4" /></>}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </main>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`hidden text-xs sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border sm:w-10" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}

function FileField({ label, file, onFile }: { label: string; file: string; onFile: (n: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-secondary">
        <Upload className="h-4 w-4" />
        <span>{file || "Click to upload PDF, JPG or PNG"}</span>
        <input
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0]?.name ?? "")}
        />
      </label>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
