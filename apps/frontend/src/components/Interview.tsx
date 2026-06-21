import { BACKEND_URL } from "@/lib/config";
import { useEffect, useReducer, useRef } from "react";
import { useParams } from "react-router";
import { DeepgramClient } from "@deepgram/sdk";
import axios from "axios";
const client = new DeepgramClient();

export function Interview() {
  const { interviewId } = useParams();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    (async () => {
      const pc = new RTCPeerConnection();

      // FIXED: removed the line that overwrote audioRef.current with a
      // detached element. We now use the actual <audio> tag rendered
      // below via the ref.

      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // FIXED: this was missing entirely. Without it, pc.createOffer()
      // produces an SDP offer with no audio media section, which is
      // exactly the error your backend/AI service was rejecting.
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      // ADDED: plays back the AI's voice response once the remote
      // track arrives.
      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0]!;
        }
      };

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
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpUrl = `${BACKEND_URL}/api/v1/session/${interviewId}`;
      const sdpResponse = await fetch(sdpUrl, {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Content-Type": "application/sdp",
        },
      });

      const answerText = await sdpResponse.text();
      console.log("SDP response status:", sdpResponse.status);

      const answer = {
        type: "answer" as "answer",
        sdp: answerText,
      };

      await pc.setRemoteDescription(answer);
    })();
  }, [interviewId]);

  return (
    <div>
      Interview
      <audio autoPlay ref={audioRef}></audio>
    </div>
  );
}