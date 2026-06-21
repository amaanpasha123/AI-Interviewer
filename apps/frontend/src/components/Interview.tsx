import { BACKEND_URL } from "@/lib/config";
import { useEffect, useReducer, useRef } from "react";
import { useParams } from "react-router";
import { DeepgramClient } from "@deepgram/sdk";
import axios from "axios";
const client = new DeepgramClient();

export function Interview() {
  const interviewId = useParams();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    (async () => {
      // const peer connection....
      const pc = new RTCPeerConnection();
      //set up to play remote audio from the model
      audioRef.current = document.createElement("audio");
      audioRef.current.autoplay = true;

      //Add the local audio track from microphone input in browser....

      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

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

      socket.onmessage = (message) =>{
        const received = JSON.parse(message.data);
        const transcript = received.channel.alternatives[0].transcript;

        if(transcript) {
            console.log(transcript);
        }
      }



      //   // Send audio data
      //   connection.socket.send(ms.getAudioTracks()[0].to);

      //       //start the session using the session description protocol......

      //       const offer = await pc.createOffer();
      //       await pc.setLocalDescription(offer);
      //       console.log("hi");

      //       const sdpResponse = await fetch(
      //         `${BACKEND_URL}/api/v1/session/${interviewId}`,
      //         {
      //           method: "POST",
      //           body: offer.sdp,
      //           headers: {
      //             "Content-Type": "application/sdp",
      //           },
      //         },
      //       );

      //       console.log("hello");

      //       const answer = {
      //         type: "answer" as "answer",
      //         sdp: await sdpResponse.text(),
      //       };

      //       await pc.setRemoteDescription(answer);
    })();
  }, [interviewId]);

  return (
    <div>
      Interview
      <audio autoPlay ref={audioRef}></audio>
    </div>
  );
}
