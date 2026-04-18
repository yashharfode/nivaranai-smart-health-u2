import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You are a careful clinical assistant supporting a triage workflow in India.
A patient describes their symptoms in plain English or Hindi. Extract structured data and draft a SOAP note in clear, simple English.

Severity guide (1-10):
- 1-4: routine (mild discomfort, no red flags)
- 5-7: urgent (significant symptoms, no immediate danger)
- 8-10: critical (chest pain, breathlessness, severe bleeding, stroke signs, syncope, anaphylaxis)

Be conservative: when in doubt about red flags, score higher.`;

const fallback = (transcript: string) => {
  const t = transcript.toLowerCase();
  if (/chest|breath|saans|seene/.test(t)) {
    return {
      main_symptom: "Chest tightness with breathlessness",
      duration: "A few hours",
      severity: 9,
      soap: {
        subjective: "Patient reports chest tightness and breathlessness onset earlier today. No prior cardiac history mentioned.",
        objective: "Awaiting vitals. Observe for diaphoresis, pallor, distress.",
        assessment: "Rule out acute coronary syndrome. Consider pulmonary embolism, panic attack as differentials.",
        plan: "Urgent triage. ECG, SpO2, BP, troponin. Aspirin 300mg if no contraindication. Escalate to ER physician.",
      },
    };
  }
  if (/fever|bukhar|temperature/.test(t)) {
    return {
      main_symptom: "Fever with sore throat",
      duration: "2 days",
      severity: 4,
      soap: {
        subjective: "Patient reports fever ~100°F with sore throat for 2 days. Mild difficulty swallowing, no body ache.",
        objective: "Awaiting examination. Check throat, lymph nodes, temperature.",
        assessment: "Likely viral pharyngitis. Rule out streptococcal infection.",
        plan: "Symptomatic care: paracetamol 500mg PRN, warm saline gargles, hydration. Review in 3 days if not improved.",
      },
    };
  }
  return {
    main_symptom: "Common cold symptoms",
    duration: "3 days",
    severity: 3,
    soap: {
      subjective: "Patient reports nasal congestion, runny nose, and mild headache for 3 days.",
      objective: "Awaiting examination.",
      assessment: "Viral upper respiratory infection.",
      plan: "Rest, fluids, paracetamol PRN, steam inhalation. Review if symptoms persist beyond 7 days.",
    },
  };
};

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let transcript = "";
        try {
          const body = await request.json();
          transcript = String(body?.transcript ?? "").slice(0, 2000);
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!transcript.trim()) {
          return Response.json({ error: "Empty transcript" }, { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ ...fallback(transcript), source: "fallback" });
        }

        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: `Patient transcript:\n"""${transcript}"""\n\nReturn a SOAP triage assessment.` },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "record_triage",
                    description: "Record extracted symptom data and SOAP note.",
                    parameters: {
                      type: "object",
                      properties: {
                        main_symptom: { type: "string", description: "One-line chief complaint." },
                        duration: { type: "string", description: "How long symptoms have lasted." },
                        severity: { type: "number", minimum: 1, maximum: 10 },
                        soap: {
                          type: "object",
                          properties: {
                            subjective: { type: "string" },
                            objective: { type: "string" },
                            assessment: { type: "string" },
                            plan: { type: "string" },
                          },
                          required: ["subjective", "objective", "assessment", "plan"],
                          additionalProperties: false,
                        },
                      },
                      required: ["main_symptom", "duration", "severity", "soap"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "record_triage" } },
            }),
          });

          if (resp.status === 429) {
            return Response.json({ error: "Rate limited. Please wait a moment." }, { status: 429 });
          }
          if (resp.status === 402) {
            return Response.json({ error: "AI credits exhausted. Add credits in Lovable workspace." }, { status: 402 });
          }
          if (!resp.ok) {
            console.error("AI gateway error", resp.status, await resp.text());
            return Response.json({ ...fallback(transcript), source: "fallback" });
          }

          const data = await resp.json();
          const call = data.choices?.[0]?.message?.tool_calls?.[0];
          const args = call?.function?.arguments;
          if (!args) {
            return Response.json({ ...fallback(transcript), source: "fallback" });
          }
          const parsed = typeof args === "string" ? JSON.parse(args) : args;
          return Response.json({ ...parsed, source: "ai" });
        } catch (e) {
          console.error("analyze error", e);
          return Response.json({ ...fallback(transcript), source: "fallback" });
        }
      },
    },
  },
});
