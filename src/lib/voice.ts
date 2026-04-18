// Lightweight Web Speech API wrapper. Falls back gracefully where unsupported.
// Improvements:
//  - Pre-requests mic via getUserMedia inside the user gesture so the browser
//    actually shows the permission prompt (SpeechRecognition.start() alone is
//    unreliable in Chromium and often fires "not-allowed" silently).
//  - Only emits FINAL transcripts (interim shown separately, never persisted)
//  - Dedupes immediate word repeats and short repeated phrases.

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

/** Remove repeated adjacent words and short phrase repeats. */
export function cleanTranscript(text: string): string {
  if (!text) return "";
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
  for (let n = 4; n >= 2; n--) {
    const re = new RegExp(`\\b((?:\\w+\\s+){${n - 1}}\\w+)(?:\\s+\\1\\b)+`, "gi");
    t = t.replace(re, "$1");
  }
  return t.trim();
}

export interface VoiceSession {
  stop: () => void;
}

/**
 * Ensure mic permission is granted by triggering getUserMedia inside the
 * caller's user gesture. The stream is released immediately — we only want
 * the prompt to appear and the permission to flip to "granted".
 *
 * Returns:
 *   "granted" - mic available
 *   "denied"  - user blocked
 *   "unsupported" - no mediaDevices API (older browser / insecure context)
 */
export async function ensureMicPermission(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Release immediately — SpeechRecognition opens its own pipeline.
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (err: any) {
    const name = err?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError") return "denied";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "unsupported";
    return "denied";
  }
}

/**
 * Start a voice session. MUST be called from inside a user-gesture handler
 * (button onClick) — this is a browser security requirement.
 */
export async function startVoice(opts: {
  lang: VoiceLang;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}): Promise<VoiceSession | null> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    opts.onError("Voice input is not supported on this browser. Please type instead.");
    return null;
  }

  // Step 1: explicitly request mic permission. This shows the browser prompt
  // reliably and lets us return a clear error message on denial.
  const perm = await ensureMicPermission();
  if (perm === "denied") {
    opts.onError(
      "Microphone access denied. Click the lock icon in the address bar → allow microphone, then try again.",
    );
    return null;
  }
  if (perm === "unsupported") {
    opts.onError("No microphone detected, or this page isn't on HTTPS. Please type your symptoms.");
    return null;
  }

  const rec = new Ctor();
  rec.lang = opts.lang;
  rec.interimResults = true;
  rec.continuous = true;

  const seenFinalIdx = new Set<number>();

  rec.onresult = (e: any) => {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = r[0]?.transcript ?? "";
      if (r.isFinal) {
        if (seenFinalIdx.has(i)) continue;
        seenFinalIdx.add(i);
        final += txt + " ";
      } else {
        interim += txt;
      }
    }
    if (final.trim()) opts.onFinal(cleanTranscript(final));
    if (interim.trim()) opts.onInterim(cleanTranscript(interim));
  };

  rec.onerror = (e: any) => {
    const code = e?.error ?? "unknown";
    const msg =
      code === "not-allowed" || code === "service-not-allowed"
        ? "Microphone access denied. Allow microphone in browser settings and reload."
        : code === "no-speech"
          ? "Didn't catch that — try speaking again."
          : code === "audio-capture"
            ? "No microphone found."
            : code === "network"
              ? "Network error during speech recognition."
              : `Voice error: ${code}`;
    opts.onError(msg);
  };

  rec.onend = () => opts.onEnd();

  try {
    rec.start();
  } catch {
    opts.onError("Could not start mic. Please try again.");
    return null;
  }
  return { stop: () => rec.stop() };
}
