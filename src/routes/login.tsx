import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Stethoscope, User, ArrowRight, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { useAuth, type Role } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — NivaranAI" },
      { name: "description", content: "Login to your NivaranAI doctor or patient dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [role, setRole] = useState<Role>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const u = await signIn(email, password, role);
      navigate({ to: u.role === "doctor" ? "/dashboard/doctor" : "/dashboard/patient" });
    } catch {
      setError("Could not sign you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto flex max-w-7xl items-center justify-center px-5 py-16 sm:px-8 sm:py-24">
        <div className="w-full max-w-md">
          <div className="text-center">
            <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Welcome back</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Login to NivaranAI</h1>
            <p className="mt-2 text-sm text-muted-foreground">Choose your role to continue.</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
            <RoleButton
              active={role === "patient"}
              onClick={() => setRole("patient")}
              icon={<User className="h-4 w-4" />}
              label="Patient"
            />
            <RoleButton
              active={role === "doctor"}
              onClick={() => setRole("doctor")}
              icon={<Stethoscope className="h-4 w-4" />}
              label="Doctor"
            />
          </div>

          <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <label className="block text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <label className="mt-4 block text-xs font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-all hover:bg-mineral disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
            </button>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to={role === "doctor" ? "/signup/doctor" : "/signup/patient"}
                className="font-medium text-primary hover:underline"
              >
                Sign up as {role}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function RoleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-foreground text-background shadow-soft"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
