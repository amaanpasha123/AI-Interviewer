import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

interface ResultData {
  transcript: {
    type: "Assistant" | "User";
    content: string;
    createdAt: Date;
  }[];
  score: number;
  feedback: string;
  status: "Done" | "InProgress" | "Pre";
}

export function Result() {
  const { interviewId } = useParams();
  const [result, setResult] = useState<ResultData>({
    score: 0,
    feedback: "",
    transcript: [],
    status: "Pre",
  });

  useEffect(() => {
    // Initial fetch
    axios
      .get(`${BACKEND_URL}/api/v1/result/${interviewId}`)
      .then((response) => {
        setResult(response.data);
      });

    // Polling setup
    let intervalId = setInterval(() => {
      axios
        .get(`${BACKEND_URL}/api/v1/result/${interviewId}`)
        .then((response) => {
          setResult(response.data);
          if (response.data.status === "Done") {
            clearInterval(intervalId);
          }
        });
    }, 5 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [interviewId]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-6 font-sans selection:bg-slate-200">
      
      {/* ⏳ LOADING STATE (While waiting for status to be "Done") */}
      {result.status !== "Done" && (
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">Evaluating Performance</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">
            Our AI engine is generating your score, transcript processing, and feedback summary. This might take a few moments...
          </p>
        </div>
      )}

      {/* ✅ RESULTS COMPLETED STATE */}
      {result.status === "Done" && (
        <div className="w-full max-w-3xl space-y-6">
          
          {/* Main Card: Feedback and Score on Top */}
          <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-100 pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Interview Assessment</h1>
                <p className="text-xs text-slate-400 mt-0.5">Session ID: {interviewId}</p>
              </div>
              
              {/* Score Display */}
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 self-start">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-black text-indigo-600">{result.score}</span>
                  <span className="text-sm font-semibold text-slate-400">/10</span>
                </div>
              </div>
            </div>

            {/* Feedback Body */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Evaluator Notes</h2>
              <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-5 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                {result.feedback || "No specific feedback generated for this session."}
              </div>
            </div>
          </div>

          {/* Conversation History Section */}
          <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <h2 className="text-base font-semibold text-slate-800 mb-6">Conversation History</h2>
            
            <div className="space-y-4">
              {result.transcript.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No dialog records found for this interview.</p>
              ) : (
                result.transcript.map((msg, index) => {
                  const isAi = msg.type === "Assistant";
                  return (
                    <div 
                      key={index} 
                      className={`flex flex-col w-full ${isAi ? "items-start" : "items-end"}`}
                    >
                      {/* Speaker Tag */}
                      <span className="text-[11px] font-medium text-slate-400 mb-1 px-1">
                        {isAi ? "🤖 AI Recruiter" : "👤 You"}
                      </span>
                      
                      {/* Dialogue Bubble */}
                      <div 
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm border ${
                          isAi 
                            ? "bg-slate-50 text-slate-700 border-slate-200/80 rounded-tl-none" 
                            : "bg-indigo-600 text-white border-indigo-700 rounded-tr-none"
                        }`}
                      >
                        {msg.content || <span className="italic opacity-60">(Silent response or audio transmission)</span>}
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