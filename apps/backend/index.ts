import express from "express";
import { preInterviewBody } from "./types";
import axios from "axios";
import { scrapeGithub } from "./scrapers/github";
import cors from "cors";
import { prisma } from "./db";
import { json } from "zod";

const app = express();

app.use(express.json());
app.use(cors());
// Parse raw SDP payloads posted from the browser
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

app.post("/api/v1/pre-interview", async (req, res) => {
  const { success, data } = preInterviewBody.safeParse(req.body);
  if (!success) {
    res.status(411).json({
      message: "Incorrect body",
    });
    return;
  }
  const githubUrl = data.github.endsWith("/")
    ? data.github.slice(0, -1)
    : data.github; // https://github.com/amaanpasha

  const githubUsername = githubUrl.split("/").pop();

  if (!githubUsername) {
    return res.status(400).json({
      message: "Invalid github URL",
    });
  }

  const githubData = await scrapeGithub(githubUsername);

  const interview = await prisma.interview.create({
    data: {
      githubMetadata: JSON.stringify(githubData),
      status: "Pre",
    },
  });

  res.json({ id: interview.id });
});

//OPEN AI API is working over here in this.......

app.post("/api/v1/session/:interviewId", async (req, res) => {
  try {
    // Step 1: Create ephemeral session + client secret
    const secretRes = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: "gpt-realtime",
            audio: {
              output: { voice: "alloy" },
            },
          },
        }),
      },
    );

    if (!secretRes.ok) {
      const detail = await secretRes.text();
      console.error("client_secrets error:", detail);
      return res
        .status(500)
        .json({ error: "Failed to create client secret", detail });
    }

    const secretData = await secretRes.json();
    const ephemeralKey = secretData.value; // ephemeral token

    // Step 2: Exchange SDP using the ephemeral key
    const callRes = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
      body: req.body, // raw SDP offer
    });

    const answerSdp = await callRes.text();

    if (!callRes.ok) {
      console.error("calls error:", answerSdp);
      return res
        .status(500)
        .json({ error: "Failed SDP exchange", detail: answerSdp });
    }

    // Location: /v1/realtime/calls/rtc_123456
    const location = callRes.headers.get("Location");
    const callId = location?.split("/").pop();
    console.log(callId);

    res.setHeader("Content-Type", "application/sdp");
    res.send(answerSdp);

    initSideband(callId, req.params.interviewId);


  } catch (error) {
    console.error("Session error:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

app.listen(3001, () => {
  console.log("server is running");
});
