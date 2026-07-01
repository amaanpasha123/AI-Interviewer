import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import axios from "axios";



export function Interview() {
  const { interviewId } = useParams();
  const audioRef = useRef<HTMLAudioElement>(null);
  const navigate = useNavigate();
  
  // Real-time audio frequency state
  const [userVolume, setUserVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState("");

  // Tracking states for interview termination
  const [isEnding, setIsEnding] = useState(false);

  

  // Keep references to cleanup functions accessible outside the main useEffect loop
  const cleanupRef = useRef<(() => void) | null>(null);

 useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let userSource: MediaStreamAudioSourceNode | null = null;
    let aiSource: MediaStreamAudioSourceNode | null = null;
    let userAnalyser: AnalyserNode | null = null;
    let aiAnalyser: AnalyserNode | null = null;
    let animationFrameId: number;
    let socket: WebSocket | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let localStream: MediaStream | null = null;
 
    (async () => {
      try {
        const pc = new RTCPeerConnection();
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

        // 🎤 1. Get User Media and pass to WebRTC
        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream = ms;
        ms.getTracks().forEach((track) => pc.addTrack(track, ms));

        // 📊 2. Track User Microphone Frequency
        userAnalyser = audioCtx.createAnalyser();
        userAnalyser.fftSize = 64;
        userSource = audioCtx.createMediaStreamSource(ms);
        userSource.connect(userAnalyser);

        // 🤖 3. Capture AI Voice Stream & Track AI Frequency
        pc.ontrack = (event) => {
          if (audioRef.current && event.streams[0]) {
            audioRef.current.srcObject = event.streams[0];

            if (audioCtx) {
              aiAnalyser = audioCtx.createAnalyser();
              aiAnalyser.fftSize = 64;
              aiSource = audioCtx.createMediaStreamSource(event.streams[0]);
              aiSource.connect(aiAnalyser);
            }
          }
        };

        // 🔄 4. Dynamic Animation Loop for Waveforms
        const updateVolumes = () => {
          if (userAnalyser) {
            const dataArray = new Uint8Array(userAnalyser.frequencyBinCount);
            userAnalyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setUserVolume(average);
          }
          if (aiAnalyser) {
            const dataArray = new Uint8Array(aiAnalyser.frequencyBinCount);
            aiAnalyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAiVolume(average);
          }
          animationFrameId = requestAnimationFrame(updateVolumes);
        };
        updateVolumes();

        // 📡 5. Deepgram Transcription Engine
        socket = new WebSocket(
          "wss://api.deepgram.com/v1/listen?model=nova-3&language=en",
          ["token", "d266694ef440163b2a456a8e908429fec6fe6b24"],
        );

        socket.onopen = () => {
          mediaRecorder = new MediaRecorder(ms, { mimeType: "audio/webm" });
          mediaRecorder.start(250);
          mediaRecorder.addEventListener("dataavailable", (event) => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
            }
          });
        };

        socket.onmessage = (message) => {
          try {
            const received = JSON.parse(message.data);
            const transcript = received.channel?.alternatives?.[0]?.transcript;

            if (transcript && transcript.trim() !== "") {
              console.log(transcript);
              setCurrentTranscript(transcript);
              
              axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/v1/session/response/${interviewId}`, {
                message: transcript,
              }).catch((err) => console.error("API transmission failed:", err));
            }
          } catch (e) {
            console.error("Deepgram frame error:", e);
          }
        };

        // 🔄 6. Complete WebRTC Handshake
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpUrl = `${import.meta.env.VITE_BACKEND_URL}/api/v1/session/${interviewId}`;
        const sdpResponse = await fetch(sdpUrl, {
          method: "POST",
          body: offer.sdp,
          headers: { "Content-Type": "application/sdp" },
        });

        const answerText = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerText });
        
      } catch (err) {
        console.error("Initialization failure:", err);
      }
    })();

    // 🛡️ Shared internal cleanup logic with strict lifecycle state checks
    const baseCleanup = () => {
      cancelAnimationFrame(animationFrameId);
      
      // FIX: Only close context if it is running or suspended!
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch((err) => console.log("AudioContext shutdown processed safely", err));
      }
      
      if (socket) {
        socket.onmessage = null; // Unbind listeners first to prevent background state updates
        socket.close();
      }
      
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };

    cleanupRef.current = baseCleanup;

    return () => baseCleanup();
  }, [interviewId]);

  // Handle manual explicit ending of the interview
  const handleEndInterview = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
    }
    
    setIsEnding(true);

    // Provide a short breather for hooks to drop off cleanly before navigating
    setTimeout(() => {
      navigate(`/result/${interviewId}`);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans antialiased text-slate-900">
      
      {/* Central Panel */}
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg p-8 shadow-[0_4px_24px_rgba(0,0,0,0.01)] flex flex-col">
        
        {/* Header Block */}
        <div className="w-full flex items-center justify-between border-b border-slate-100 pb-6 mb-8">
          <div>
            <h1 className="text-lg font-medium tracking-tight text-slate-900">Placement Assessment</h1>
            <p className="text-xs text-slate-400 font-mono mt-1">ID: {interviewId}</p>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md">
            <span className={`w-1.5 h-1.5 rounded-full ${isEnding ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className="text-[11px] font-medium tracking-wide uppercase text-slate-600">
              {isEnding ? "Saving Audio" : "Connected"}
            </span>
          </div>
        </div>

        {isEnding ? (
          <div className="w-full py-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600">Closing real-time streaming engines...</p>
          </div>
        ) : (
          <>
            {/* Audio Frequency Bars */}
            <div className="w-full grid grid-cols-2 gap-4 mb-6">
              
              {/* User Input Frequency */}
              <div className="flex flex-col items-center justify-center p-6 border border-slate-100 rounded-md">
                <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase mb-4">User Input</p>
                <div className="h-12 flex items-center justify-center gap-1.5">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      style={{ 
                        height: `${Math.max(4, userVolume * (0.4 + i * 0.2))}px`,
                        maxHeight: '48px'
                      }}
                      className="w-1 bg-slate-800 rounded-full transition-all duration-75 ease-out"
                    />
                  ))}
                </div>
              </div>

              {/* AI Recruiter Frequency */}
              <div className="flex flex-col items-center justify-center p-6 border border-slate-100 rounded-md">
                <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase mb-4">AI Recruiter</p>
                <div className="h-12 flex items-center justify-center gap-1.5">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      style={{ 
                        height: `${Math.max(4, aiVolume * (0.4 + i * 0.2))}px`,
                        maxHeight: '48px'
                      }}
                      className="w-1 bg-slate-400 rounded-full transition-all duration-75 ease-out"
                    />
                  ))}
                </div>
              </div>

            </div>

            {/* Minimal Subtitles Box */}
            <div className="w-full min-h-[56px] border border-slate-100 bg-slate-50/50 rounded-md p-4 flex items-center justify-center text-center mb-8">
              {currentTranscript ? (
                <p className="text-sm text-slate-700 leading-relaxed font-light">
                  "{currentTranscript}"
                </p>
              ) : (
                <p className="text-xs text-slate-400 tracking-wide font-light italic">
                  Awaiting speech input...
                </p>
              )}
            </div>

            {/* Action Button Strip */}
            <div className="w-full pt-2 flex justify-end">
              <button 
                onClick={handleEndInterview}
                className="px-5 py-2 text-xs font-medium tracking-wide uppercase border border-red-200 text-red-600 bg-white hover:bg-red-50/50 active:bg-red-50 rounded-md transition-all duration-150 cursor-pointer"
              >
                End Interview
              </button>
            </div>
          </>
        )}

      </div>

      <audio autoPlay ref={audioRef} className="hidden" />
    </div>
  );
}