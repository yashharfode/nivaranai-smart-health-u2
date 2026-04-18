import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — NivaranAI" },
      {
        name: "description",
        content: "Get in touch with the NivaranAI team for support, partnerships, and onboarding.",
      },
      { property: "og:title", content: "Contact NivaranAI" },
      {
        property: "og:description",
        content: "Email yashharfode123@gmail.com or call +91 8819244133.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-20">
        <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Contact us</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          We'd love to hear from you
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          For hospital onboarding, technical support, or partnership enquiries — reach out and we'll
          get back within one business day.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:yashharfode123@gmail.com"
            className="group rounded-3xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
              <Mail className="h-5 w-5" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="mt-1 font-display text-lg font-semibold text-foreground group-hover:text-primary">
              yashharfode123@gmail.com
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Best for detailed enquiries.</p>
          </a>

          <a
            href="tel:+918819244133"
            className="group rounded-3xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
              <Phone className="h-5 w-5" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Phone</p>
            <p className="mt-1 font-display text-lg font-semibold text-foreground group-hover:text-primary">
              +91 8819244133
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Mon–Sat, 9 AM – 7 PM IST.</p>
          </a>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-secondary/40 p-6">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-sm font-semibold">NivaranAI HQ</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Building bridges between AI, doctors, and patients across India.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
