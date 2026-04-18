import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Logo } from "./Logo";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-display text-lg font-semibold tracking-tight">NivaranAI</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            We are not just building software. We are improving healthcare outcomes.
          </p>
        </div>
        <div>
          <p className="font-display text-sm font-semibold">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a className="hover:text-foreground" href="/#features">Features</a></li>
            <li><a className="hover:text-foreground" href="/#how">How it works</a></li>
            <li><a className="hover:text-foreground" href="/#security">Security</a></li>
          </ul>
        </div>
        <div>
          <p className="font-display text-sm font-semibold">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-foreground">Login</Link></li>
            <li><Link to="/signup/patient" className="hover:text-foreground">Patient signup</Link></li>
            <li><Link to="/signup/doctor" className="hover:text-foreground">Doctor signup</Link></li>
            <li><Link to="/signup/hospital" className="hover:text-foreground">Register hospital / clinic</Link></li>
            <li><Link to="/admin-secret" className="text-xs text-muted-foreground/60 hover:text-foreground">Admin</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:px-8">
          <p>© {new Date().getFullYear()} NivaranAI. {t("footer.rights")}</p>
          <p>Made with care for clinicians and patients.</p>
        </div>
      </div>
    </footer>
  );
}
