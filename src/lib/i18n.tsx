import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.features": "Features",
  "nav.howItWorks": "How it works",
  "nav.impact": "Impact",
  "nav.security": "Security",
  "nav.tryDemo": "Try Demo",
  "nav.dashboard": "Dashboard",
  "hero.eyebrow": "AI-powered clinical assistant",
  "hero.title": "Healthcare needs to be faster, smarter, and fairer.",
  "hero.subtitle":
    "NivaranAI runs voice-based pre-consultations, generates SOAP notes, and triages patients — so doctors can focus on care, not paperwork.",
  "hero.cta.primary": "Try Demo",
  "hero.cta.secondary": "Login / Dashboard",
  "hero.trust": "Trusted by clinicians across India",
  "footer.rights": "All rights reserved.",
};

const hi: Dict = {
  "nav.features": "सुविधाएँ",
  "nav.howItWorks": "यह कैसे काम करता है",
  "nav.impact": "प्रभाव",
  "nav.security": "सुरक्षा",
  "nav.tryDemo": "डेमो आज़माएँ",
  "nav.dashboard": "डैशबोर्ड",
  "hero.eyebrow": "एआई-संचालित क्लिनिकल सहायक",
  "hero.title": "स्वास्थ्य सेवा तेज़, स्मार्ट और निष्पक्ष होनी चाहिए।",
  "hero.subtitle":
    "NivaranAI आवाज़-आधारित परामर्श-पूर्व बातचीत करता है, SOAP नोट्स तैयार करता है और मरीज़ों को प्राथमिकता देता है।",
  "hero.cta.primary": "डेमो आज़माएँ",
  "hero.cta.secondary": "लॉगिन / डैशबोर्ड",
  "hero.trust": "भारत भर के चिकित्सकों द्वारा भरोसेमंद",
  "footer.rights": "सर्वाधिकार सुरक्षित।",
};

const dicts: Record<Lang, Dict> = { en, hi };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("nivaran.lang") as Lang | null;
    if (saved === "en" || saved === "hi") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("nivaran.lang", l);
  };

  const t = (key: string) => dicts[lang][key] ?? dicts.en[key] ?? key;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
