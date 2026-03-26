import { Bot, SendHorizonal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCopilotMessageMutation, useDailyBriefingQuery } from "../api/copilot";
import type { CopilotMessage } from "../types";

const fallbackEnglish = [
  "Critical incidents remain concentrated in identity endpoints. Next: move OPEN identity incidents to CONTAINED and rotate exposed tokens.",
  "Overnight activity shows elevated API abuse attempts on civic services. Next: tighten rate limits and monitor offender IP clusters.",
  "The highest-risk pattern is privilege escalation in admin workflows. Next: enforce MFA reset for privileged accounts.",
  "Threat posture is stable but high-severity incidents require manual review. Next: validate remediation completion for each incident ID.",
  "Election-facing systems show increased probing activity. Next: keep WAF strict mode enabled during peak public traffic.",
];

const fallbackHindi = [
  "अभी सबसे गंभीर जोखिम identity endpoints पर है। अगला कदम: OPEN incidents को तुरंत CONTAINED करें और tokens rotate करें।",
  "रात में civic services पर API abuse बढ़ा है। अगला कदम: rate limits सख्त करें और offender IP clusters मॉनिटर करें।",
  "सबसे जोखिमपूर्ण पैटर्न privilege escalation है। अगला कदम: सभी privileged accounts के लिए MFA reset लागू करें।",
  "वर्तमान स्थिति नियंत्रित है, पर HIGH incidents की manual समीक्षा आवश्यक है। अगला कदम: हर incident ID की remediation verify करें।",
  "Election-facing systems पर probing activity बढ़ी है। अगला कदम: peak traffic तक WAF strict mode चालू रखें।",
];

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default function CopilotPage() {
  const [language, setLanguage] = useState<"hindi" | "english">("english");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [briefingEnabled, setBriefingEnabled] = useState(false);
  const [sessionId] = useState(() => `session-${crypto.randomUUID()}`);

  const mutation = useCopilotMessageMutation();
  const briefingQuery = useDailyBriefingQuery(briefingEnabled);

  const suggestions = useMemo(
    () => [
      "What happened last night?",
      "कल रात क्या हुआ?",
      "Show me critical incidents",
      "सबसे खतरनाक हमले कौन से हैं?",
    ],
    [],
  );

  useEffect(() => {
    if (!briefingQuery.data) {
      return;
    }

    const text = language === "hindi" ? briefingQuery.data.hindi : briefingQuery.data.english;
    setMessages((current) => [...current, { role: "assistant", message: text, timestamp: new Date().toISOString() }]);
  }, [briefingQuery.data, language]);

  async function submitMessage(content: string): Promise<void> {
    if (!content.trim()) {
      return;
    }

    const userMessage: CopilotMessage = {
      role: "user",
      message: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");

    try {
      const response = await mutation.mutateAsync({
        message: content.trim(),
        language,
        sessionId,
      });

      setMessages((current) => [
        ...current,
        { role: "assistant", message: response.reply, timestamp: new Date().toISOString() },
      ]);
    } catch (_error) {
      const fallbackList = language === "hindi" ? fallbackHindi : fallbackEnglish;
      const fallback = fallbackList[messages.length % fallbackList.length];

      setMessages((current) => [...current, { role: "assistant", message: fallback, timestamp: new Date().toISOString() }]);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-100">CISO Co-Pilot</h2>
          <div className="flex overflow-hidden rounded-md border border-slate-700">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm ${language === "hindi" ? "bg-red-500 text-white" : "bg-slate-900 text-slate-300"}`}
              onClick={() => setLanguage("hindi")}
            >
              हिंदी
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm ${language === "english" ? "bg-red-500 text-white" : "bg-slate-900 text-slate-300"}`}
              onClick={() => setLanguage("english")}
            >
              English
            </button>
          </div>
        </div>

        <div className="mb-4 h-[460px] space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 p-4 scrollbar-thin">
          {messages.map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "bg-red-500 text-white" : "bg-slate-800 text-slate-100"}`}>
                {message.role === "assistant" ? <Bot className="mb-1 h-4 w-4 text-red-400" /> : null}
                <p>{message.message}</p>
                <p className="mt-1 text-[10px] opacity-70">{formatTime(message.timestamp)}</p>
              </div>
            </div>
          ))}

          {mutation.isPending ? <p className="text-sm text-slate-400">KAVACH is typing...</p> : null}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={language === "hindi" ? "अपना प्रश्न लिखें..." : "Ask KAVACH..."}
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void submitMessage(input);
              }
            }}
          />
          <button
            type="button"
            className="rounded-md bg-red-500 px-3 py-2 text-white hover:bg-red-600"
            onClick={() => void submitMessage(input)}
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel">
        <button
          type="button"
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          onClick={() => {
            setBriefingEnabled(true);
            void briefingQuery.refetch();
          }}
        >
          Daily Briefing
        </button>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Suggested Questions</p>
          <div className="space-y-2">
            {suggestions.map((question) => (
              <button
                key={question}
                type="button"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs text-slate-200 hover:border-slate-500"
                onClick={() => void submitMessage(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
