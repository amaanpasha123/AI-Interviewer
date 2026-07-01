import express from "express";
import { preInterviewBody } from "./types";
import { scrapeGithub } from "./scrapers/github";
import cors from "cors";
import { prisma } from "./db";
import { initSideband } from "./sideband";
import { calculateResult } from "./result";
import { Result } from "pg";

const app = express();

app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.endsWith(".vercel.app")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
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
  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: "gpt-realtime",
    audio: { output: { voice: "marin" } },
  });

  const fd = new FormData();
  fd.set("sdp", req.body);
  fd.set("session", sessionConfig);

  try {
    const sdpResponse = await fetch(
      "https://api.openai.com/v1/realtime/calls",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
          "OpenAI-Safety-Identifier": "hashed-user-id",
        },
        body: fd,
      },
    );

    const location = sdpResponse.headers.get("Location");
    const callId = location?.split("/").pop()!;
    console.log(callId);
    // Send back the SDP we received from the OpenAI REST API
    const sdp = await sdpResponse.text();
    res.send(sdp);
    initSideband(callId, req.params.interviewId);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

app.post("/api/v1/session/response/:interviewId", async (req, res) => {
  const { message } = req.body;
  await prisma.message.create({
    data: {
      interviewId: req.params.interviewId!,
      type: "User",
      message: message,
    },
  });
  res.json({ message: "Message saved" });
});



app.get("/api/v1/result/:interviewId", async (req, res) => {
  try {
    const interview = await prisma.interview.findFirst({
      where: { id: req.params.interviewId },
      include: { conversation: true },
    });

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Already done — return cached result immediately
    if ((interview.status as string) === "Done") {
      return res.json({
        score: interview.score,
        feedback: interview.feedback,
        status: "Done",
        transcript: interview.conversation.map((c) => ({
          type: c.type,
          content: c.message,
          createdAt: c.createdAt,
        })),
      });
    }

    // Someone else is already processing — tell frontend to poll again
    if ((interview.status as string) === "Processing") {
      return res.status(202).json({
        message: "Evaluation in progress, please retry shortly.",
        status: "Processing",
      });
    }

    // Atomically claim the work (InProgress/Pre → Processing)
    const locked = await prisma.interview.updateMany({
      where: {
        id: req.params.interviewId,
        status: { in: ["Pre", "InProgress"] as any },
      },
      data: { status: "Processing" as any },
    });

    // Lost the race — another request claimed it just now
    if (locked.count === 0) {
      return res.status(202).json({
        message: "Evaluation in progress, please retry shortly.",
        status: "Processing",
      });
    }

    // We own the lock — call Gemini exactly once
    let result;
    try {
      result = await calculateResult(interview.conversation);
    } catch (geminiError: any) {
      // Gemini failed — reset to InProgress so it can be retried later,
      // but DON'T loop immediately. Let the frontend's next poll trigger it.
        console.error("GEMINI ERROR:", JSON.stringify(geminiError, null, 2));
      await prisma.interview.update({
        where: { id: req.params.interviewId },
        data: { status: "InProgress" as any },
      }).catch(() => {}); // swallow secondary DB error

      const isRateLimit =
        geminiError?.status === 429 ||
        JSON.stringify(geminiError).includes("429") ||
        JSON.stringify(geminiError).toLowerCase().includes("quota");

      if (isRateLimit) {
        return res.status(429).json({
          message: "Gemini quota exceeded. Please wait 1 minute before retrying.",
          status: "InProgress",
        });
      }

      return res.status(500).json({
        message: "Evaluation failed. Please try again.",
        status: "InProgress",
      });
    }

    const updated = await prisma.interview.update({
      where: { id: req.params.interviewId },
      data: {
        feedback: result.feedback,
        score: result.score,
        status: "Done" as any,
      },
    });

    return res.json({
      score: updated.score,
      feedback: updated.feedback,
      status: "Done",
      transcript: interview.conversation.map((c) => ({
        type: c.type,
        content: c.message,
        createdAt: c.createdAt,
      })),
    });

  } catch (error) {
    console.error("Unexpected error in result handler:", error);
    return res.status(500).json({
      message: "Internal server error.",
      status: "InProgress",
    });
  }
});

app.listen(3001, () => {
  console.log("server is running");
});
