import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Solution } from "@/components/landing/Solution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { Impact } from "@/components/landing/Impact";
import { Trust } from "@/components/landing/Trust";
import { FutureReady } from "@/components/landing/FutureReady";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { useScrollReveal } from "@/lib/reveal";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  useScrollReveal();
  useEffect(() => {
    // re-trigger on hash navigation
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Features />
        <Impact />
        <Trust />
        <FutureReady />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
