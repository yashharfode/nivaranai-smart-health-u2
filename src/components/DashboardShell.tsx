import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LogOut, Globe, ArrowLeft } from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo } from "./Logo";

export function DashboardShell({
  children,
  requiredRole,
  title,
  subtitle,
  nav,
}: {
  children: ReactNode;
  requiredRole: Role;
  title: string;
  subtitle?: string;
  nav?: ReactNode;
}) {
  const { user, signOut, loading } = useAuth();
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
    } else if (user.role !== requiredRole) {
      navigate({ to: user.role === "doctor" ? "/dashboard/doctor" : "/dashboard/patient" });
    }
  }, [user, loading, requiredRole, navigate, location.pathname]);

  if (loading || !user || user.role !== requiredRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 z-40 border-b border-border/60 glass-strong">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="hidden font-display text-base font-semibold tracking-tight sm:inline">
                NivaranAI
              </span>
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden text-xs uppercase tracking-wider text-muted-foreground sm:inline">
              {requiredRole === "doctor" ? "Clinician" : "Patient"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === "en" ? "EN" : "हिं"}
            </button>
            <button
              onClick={() => {
                signOut();
                navigate({ to: "/" });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back to site
            </Link>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {nav}
        </div>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
