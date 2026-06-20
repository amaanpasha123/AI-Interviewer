import { WebSocket } from "ws";

export function initSideband(callId: string, interviewId: string, attempt = 1) {
  const url = `wss://api.openai.com/v1/realtime?call_id=${callId}`;

  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_KEY}`,
    },
  });

  ws.on("open", () => {
    console.log("Sideband connected");

    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          instructions:
            `You are interviewing a candidate to assess their computer science knowledge.
             Ask 2-3 questions based on their stated experience.
             please use English during the interview`,
        },
      }),
    );
  });

  ws.on("message", function incoming(message){
    const pasedMessage = JSON.parse(message.toString());
    if(pasedMessage.type == "response.done"){
        console.log(JSON.stringify(pasedMessage));
    }
  })
}
