import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, ArrowRight, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { setHospitalSession, verifyHospitalLogin } from "@/lib/hospitalAuth";

export const Route = createFileRoute("/login_/hospital")({
  head: () => ({ meta: [{ title: "Hospital Admin Login — NivaranAI" }] }),
  component: HospitalLogin,
});

function HospitalLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));

    const cred = verifyHospitalLogin(username, password);
    setSubmitting(false);

    if (!cred) {
      setError("Invalid credentials. Use the details issued by the admin.");
      return;
    }

    setHospitalSession(cred.facilityId);
    toast.success("Welcome back to your dashboard");
    navigate({ to: "/dashboard/hospital" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto flex max-w-7xl items-center justify-center px-5 py-16 sm:px-8 sm:py-24">
        <div className="w-full max-w-md">
          <div className="text-center">
            <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">
              Facility Portal
            </p>
            <div className="mt-2 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-soft">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
              Hospital Admin
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the credentials issued after admin approval.
            </p>
          </div>

          <form
            onSubmit={submit}
            className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8"
          >
            <label className="block text-xs font-medium text-muted-foreground">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="apollocity123"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              required
            />

            <label className="mt-4 block text-xs font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              required
            />

            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-all hover:bg-mineral disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Access Dashboard <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="mt-6 space-y-3 text-center">
              <p className="text-xs text-muted-foreground">
                New facility?{" "}
                <Link to="/signup/hospital" className="font-medium text-primary hover:underline">
                  Register here
                </Link>
              </p>

              <div className="border-t border-border pt-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <User className="h-3 w-3" /> User login
                </Link>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
