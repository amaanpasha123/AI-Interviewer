import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

interface ResultData {
  transcript: {
    type: "Assistant" | "User";
    content: string;
    createdAt: Date;
  }[];
  score: number;
  feedback: string;
  status: "Done" | "InProgress" | "Pre" | "Processing";
}

// How long to wait between polls depending on the situation
const POLL_INTERVAL_NORMAL = 5_000;   // 5s while processing
const POLL_INTERVAL_RATE_LIMIT = 65_000; // 65s after a 429

export function Result() {
  const { interviewId } = useParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<ResultData>({
    score: 0,
    feedback: "",
    transcript: [],
    status: "Pre",
  });

  // Use refs so the timeout callback always sees the latest values
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const startCountdown = (seconds: number) => {
    setRetryCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1_000);
  };

  const schedulePoll = (delayMs: number) => {
    timeoutRef.current = setTimeout(poll, delayMs);
  };

  const poll = async () => {
    if (!isMountedRef.current) return;

    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/v1/result/${interviewId}`
      );

      if (!isMountedRef.current) return;

      setErrorMsg(null);
      setIsRateLimited(false);
      setRetryCountdown(null);
      setResult(response.data);

      // Stop polling once done
      if (response.data.status === "Done") return;

      // Still processing — poll again normally
      schedulePoll(POLL_INTERVAL_NORMAL);
    } catch (err: any) {
      if (!isMountedRef.current) return;

      const status = err.response?.status;
      const message =
        err.response?.data?.message || "An error occurred. Retrying soon...";

      if (status === 404 || status === 411) {
        // Hard error — interview doesn't exist, stop polling
        setErrorMsg("Interview not found. Please check your link.");
        return;
      }

      if (status === 429) {
        // Rate limited — back off for 65s and show a countdown
        setErrorMsg(message);
        setIsRateLimited(true);
        startCountdown(Math.ceil(POLL_INTERVAL_RATE_LIMIT / 1000));
        schedulePoll(POLL_INTERVAL_RATE_LIMIT);
        return;
      }

      // 202 or 5xx — still in progress, poll again normally
      setErrorMsg(status === 202 ? null : message);
      schedulePoll(POLL_INTERVAL_NORMAL);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    // Single entry point — no duplicate initial fetch + interval
    poll();

    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [interviewId]);

  const isLoading = result.status !== "Done";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-6 font-sans selection:bg-slate-200">

      {/* Error / rate-limit banner */}
      {errorMsg && (
        <div className="w-full max-w-2xl mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex flex-col gap-1 shadow-sm">
          <span className="font-semibold flex items-center gap-1.5">
            ⚠️ Status Notice
          </span>
          <p className="text-amber-700/90">{errorMsg}</p>
          {isRateLimited && retryCountdown !== null && (
            <p className="text-amber-600 font-medium mt-1">
              Retrying automatically in {retryCountdown}s…
            </p>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">
            Evaluating Performance
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">
            {isRateLimited
              ? "The AI evaluator is busy. We'll retry automatically — no need to refresh."
              : "Our AI engine is generating your score, transcript, and feedback. This might take a few moments…"}
          </p>
        </div>
      )}

      {/* Results */}
      {result.status === "Done" && (
        <div className="w-full max-w-3xl space-y-6">

          {/* Score + Feedback card */}
          <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-100 pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Interview Assessment
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Session ID: {interviewId}
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 self-start">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Score
                </span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-black text-indigo-600">
                    {result.score}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    /10
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Evaluator Notes
              </h2>
              <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-5 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                {result.feedback ||
                  "No specific feedback generated for this session."}
              </div>
            </div>
          </div>

          {/* Transcript card */}
          <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <h2 className="text-base font-semibold text-slate-800 mb-6">
              Conversation History
            </h2>

            <div className="space-y-4">
              {result.transcript.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No dialog records found for this interview.
                </p>
              ) : (
                result.transcript.map((msg, index) => {
                  const isAi = msg.type === "Assistant";
                  return (
                    <div
                      key={index}
                      className={`flex flex-col w-full ${isAi ? "items-start" : "items-end"}`}
                    >
                      <span className="text-[11px] font-medium text-slate-400 mb-1 px-1">
                        {isAi ? "🤖 AI Recruiter" : "👤 You"}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm border ${
                          isAi
                            ? "bg-slate-50 text-slate-700 border-slate-200/80 rounded-tl-none"
                            : "bg-indigo-600 text-white border-indigo-700 rounded-tr-none"
                        }`}
                      >
                        {msg.content || (
                          <span className="italic opacity-60">
                            (Silent response or audio transmission)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
