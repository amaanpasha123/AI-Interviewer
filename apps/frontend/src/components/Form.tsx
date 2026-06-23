import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "../lib/config";
import { useNavigate } from "react-router";

export function Form() {
  const [github, setGithub] = useState("");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!github || !github.includes("github.com")) {
      toast.error("Please provide a valid GitHub repository or profile URL");
      return;
    }
    
    setLoading(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
        github,
      });

      if (response.data && response.data.id) {
        navigate(`/interview/${response.data.id}`);
      } else {
        throw new Error("Invalid response structural signature from server");
      }
    } catch (error) {
      console.error("Form transmission failed:", error);
      toast.error("Failed to initialize session. Please check your network context.");
      setLoading(false);
    }
  }

  return (
    // Outer canvas stays pure clean white
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans antialiased text-slate-900">
      
      {/* Refined Panel: Sophisticated warm slate-gray tint */}
      <div className="w-full max-w-md bg-slate-50/60 border border-slate-200/80 rounded-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-sm">
        
        {/* Header Unit */}
        <div className="text-center border-b border-slate-200/60 pb-6 mb-6">
          {/* ✅ text-black and font-semibold make the main header stand out sharply */}
          <h1 className="text-xl font-semibold tracking-tight text-black">
            AI Technical Interview
          </h1>
          {/* ✅ Darkened description text for clean readability */}
          <p className="text-xs text-slate-500 mt-1.5 font-normal">
            Enter your details below to initialize the custom placement assessment.
          </p>
        </div>

        {/* Form Inputs Container */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            {/* ✅ Strengthened label contrast and weight */}
            <label className="text-[11px] font-semibold text-slate-700 tracking-wider uppercase">
              GitHub Profile or Repository URL
            </label>
            {/* Input stays crisp white to contrast beautifully against the panel background */}
            <Input
              type="url"
              placeholder="https://github.com/your-username"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="bg-white border-slate-200 text-slate-950 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:border-slate-400 rounded-md placeholder:text-slate-400 text-sm h-10"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-8 pt-4 flex justify-end border-t border-slate-200/60">
          <Button 
            disabled={loading} 
            onClick={onSubmit}
            className="w-full sm:w-auto px-6 h-10 text-xs font-medium tracking-wide uppercase bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 border border-transparent rounded-md transition-all duration-150 cursor-pointer"
          >
            {loading ? "Initializing..." : "Start Interview"}
          </Button>
        </div>

      </div>

    </div>
  );
}