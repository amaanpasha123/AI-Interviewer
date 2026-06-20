import { WebSocket } from "ws";


export function initSideband(callId: String, interviewId: String) {

  // Connect to a WebSocket for the in-progress call
  const url = "wss://api.openai.com/v1/realtime?call_id=" + callId;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_KEY,
    },
  });

  ws.on("open", function open() {
    console.log("Connected to server.");

    // Send client events over the WebSocket once connected
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: `you are supposed to interview this 
          their computer science intellect. Ask around 2-3 question 
          base on their experience `,
        },
      }),
    );
  });

  // Listen for and parse server events
  ws.on("message", function incoming(message) {
    console.log(JSON.parse(message.toString()));
  });
}
