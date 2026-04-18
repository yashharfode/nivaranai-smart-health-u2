// Lightweight Web Speech API wrapper. Falls back gracefully where unsupported.

export type VoiceLang = "en-IN" | "hi-IN";

interface MinimalRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export function getRecognitionCtor(): (new () => MinimalRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isVoiceSupported() {
  return getRecognitionCtor() !== null;
}

export interface VoiceSession {
  stop: () => void;
}

export function startVoice(opts: {
  lang: VoiceLang;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}): VoiceSession | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    opts.onError("Voice input not supported on this browser. Please type instead.");
    return null;
  }
  const rec = new Ctor();
  rec.lang = opts.lang;
  rec.interimResults = true;
  rec.continuous = true;

  rec.onresult = (e: any) => {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) opts.onFinal(final);
    if (interim) opts.onInterim(interim);
  };
  rec.onerror = (e: any) => {
    const msg = e?.error === "not-allowed"
      ? "Microphone permission denied."
      : `Voice error: ${e?.error ?? "unknown"}`;
    opts.onError(msg);
  };
  rec.onend = () => opts.onEnd();

  try {
    rec.start();
  } catch (e) {
    opts.onError("Could not start mic.");
    return null;
  }
  return { stop: () => rec.stop() };
}
