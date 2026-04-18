import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, X, Globe } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";

export function Header() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const onLandingPage = location.pathname === "/";

  const navLinks = [
    { href: "/#features", label: t("nav.features") },
    { href: "/#how", label: t("nav.howItWorks") },
    { href: "/#impact", label: t("nav.impact") },
    { href: "/#security", label: t("nav.security") },
  ];

  const goDashboard = () => {
    if (!user) {
      navigate({ to: "/demo" });
    } else if (user.role === "doctor") {
      navigate({ to: "/dashboard/doctor" });
    } else {
      navigate({ to: "/dashboard/patient" });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 glass-strong">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-semibold tracking-tight">NivaranAI</span>
        </Link>

        {onLandingPage && (
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/signup/hospital"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            For hospitals
          </Link>
          <Link
            to="/contact"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Contact
          </Link>
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === "en" ? "EN" : "हिं"}
          </button>
          <button
            onClick={goDashboard}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:bg-mineral hover:shadow-soft"
          >
            {user ? t("nav.dashboard") : t("nav.tryDemo")}
          </button>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            {onLandingPage &&
              navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setLang(lang === "en" ? "hi" : "en")}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <Globe className="h-4 w-4" />
                {lang === "en" ? "English" : "हिंदी"}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  goDashboard();
                }}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                {user ? t("nav.dashboard") : t("nav.tryDemo")}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
