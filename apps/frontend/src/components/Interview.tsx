import { BACKEND_URL } from "@/lib/config";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import axios from "axios";

export function Interview() {
  const { interviewId } = useParams();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // State for visualizer scaling animations
  const [userVolume, setUserVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState("");

  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let userSource: MediaStreamAudioSourceNode | null = null;
    let aiSource: MediaStreamAudioSourceNode | null = null;
    let userAnalyser: AnalyserNode | null = null;
    let aiAnalyser: AnalyserNode | null = null;
    let animationFrameId: number;

    (async () => {
      const pc = new RTCPeerConnection();
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      // 🎤 Set up User Voice Tracker
      userAnalyser = audioCtx.createAnalyser();
      userAnalyser.fftSize = 64;
      userSource = audioCtx.createMediaStreamSource(ms);
      userSource.connect(userAnalyser);

      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];

          // 🤖 Set up AI Voice Tracker when the remote audio stream arrives
          if (audioCtx && userAnalyser) {
            aiAnalyser = audioCtx.createAnalyser();
            aiAnalyser.fftSize = 64;
            aiSource = audioCtx.createMediaStreamSource(event.streams[0]);
            aiSource.connect(aiAnalyser);
          }
        }
      };

      // 🔄 Animate Waveforms based on actual audio data frequencies
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

      // Deepgram Setup
      const socket = new WebSocket(
        "wss://api.deepgram.com/v1/listen?model=nova-3&language=en",
        ["token", "d266694ef440163b2a456a8e908429fec6fe6b24"],
      );

      socket.onopen = () => {
        const mediaRecorder = new MediaRecorder(ms, { mimeType: "audio/webm" });
        mediaRecorder.start(250);
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(event.data);
        });
      };

      socket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel.alternatives[0].transcript;

        if (transcript) {
          console.log(transcript);
          setCurrentTranscript(transcript);
          axios.post(`${BACKEND_URL}/api/v1/session/response/${interviewId}`, {
            message: transcript,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpUrl = `${BACKEND_URL}/api/v1/session/${interviewId}`;
      const sdpResponse = await fetch(sdpUrl, {
        method: "POST",
        body: offer.sdp,
        headers: { "Content-Type": "application/sdp" },
      });

      const answerText = await sdpResponse.text();
      const answer = { type: "answer" as const, sdp: answerText };
      await pc.setRemoteDescription(answer);
    })();

    // Cleanup resources on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (audioCtx) audioCtx.close();
    };
  }, [interviewId]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans selection:bg-slate-200">
      
      {/* Container Box */}
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center">
        
        {/* Header Unit */}
        <div className="w-full flex items-center justify-between border-b border-slate-100 pb-5 mb-10">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">AI Placement Interview</h1>
            <p className="text-xs text-slate-400 mt-0.5">Session ID: {interviewId}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700">Live Connection</span>
          </div>
        </div>

        {/* Waves Section */}
        <div className="w-full grid grid-cols-2 gap-8 mb-10">
          
          {/* User Waveform Panel */}
          <div className="flex flex-col items-center p-6 bg-slate-50/50 rounded-xl border border-slate-100">
            <span className="text-xs font-medium text-slate-500 mb-4 tracking-wide uppercase">Your Microhpone</span>
            <div className="h-16 flex items-center gap-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  style={{ height: `${Math.max(4, userVolume * (1 + i * 0.2))}px` }}
                  className="w-1.5 bg-indigo-500 rounded-full transition-all duration-75 ease-out"
                />
              ))}
            </div>
          </div>

          {/* AI Voice Waveform Panel */}
          <div className="flex flex-col items-center p-6 bg-slate-50/50 rounded-xl border border-slate-100">
            <span className="text-xs font-medium text-slate-500 mb-4 tracking-wide uppercase">AI Recruiter</span>
            <div className="h-16 flex items-center gap-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  style={{ height: `${Math.max(4, aiVolume * (1 + i * 0.2))}px` }}
                  className="w-1.5 bg-emerald-500 rounded-full transition-all duration-75 ease-out"
                />
              ))}
            </div>
          </div>

        </div>

        {/* Subtitles/Live Transcript Feed */}
        <div className="w-full min-h-[60px] bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-center text-center">
          {currentTranscript ? (
            <p className="text-sm text-slate-600 font-medium italic">"{currentTranscript}"</p>
          ) : (
            <p className="text-xs text-slate-400 tracking-wide">Listening for speech input...</p>
          )}
        </div>

      </div>

      {/* Hidden Audio element for stream destination playback */}
      <audio autoPlay ref={audioRef} className="hidden" />
    </div>
  );
}