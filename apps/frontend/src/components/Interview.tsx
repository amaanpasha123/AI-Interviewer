import { BACKEND_URL } from "@/lib/config";
import { useEffect, useReducer, useRef } from "react";
import { useParams } from "react-router";

export function Interview() {
  const interviewId = useParams();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let pc: RTCPeerConnection | null = null;
    let localStream: MediaStream | null = null;
    let cancelled = false; // ✅ flag to bail out if effect cleanup ran

    (async () => {
      try {
        pc = new RTCPeerConnection();
        if (cancelled) {
          pc.close();
          return;
        }

        pc.ontrack = (e) => {
          if (audioRef.current) audioRef.current.srcObject = e.streams[0]!;
        };

        const dc = pc.createDataChannel("oai-events");
        dc.onopen = () => {
          dc.send(
            JSON.stringify({
              type: "session.update",
              session: {
                modalities: ["audio", "text"],
                voice: "alloy",
              },
            }),
          );
        };

        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          // ✅ bail before touching pc again
          localStream.getTracks().forEach((t) => t.stop());
          pc.close();
          return;
        }

        pc.addTrack(localStream.getTracks()[0]!);

        const offer = await pc.createOffer();
        if (cancelled) return;
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(`${BACKEND_URL}/api/v1/session/${interviewId}`, {
          method: "POST",
          body: offer.sdp,
          headers: { "Content-Type": "application/sdp" },
        });

        if (!sdpResponse.ok) throw new Error("Session creation failed");
        const answerSdp = await sdpResponse.text();

        if (cancelled) return; // ✅ check again before setting remote description
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (err) {
        if (!cancelled) console.error("Interview setup failed:", err);
      }
    })();

    return () => {
      cancelled = true; // ✅ tells in-flight async to stop touching pc
      pc?.close();
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);



  return (
    <div>
        Interview
      <audio autoPlay ref={audioRef}></audio>
    </div>
  );
}
