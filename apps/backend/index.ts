import express from "express";
import { preInterviewBody } from "./types";
import axios from "axios";
import { scrapeGithub } from "./scrapers/github";
import cors from "cors";
import { prisma } from "./db";
import { json } from "zod";
import { initSideband } from "./sideband";
import { calculateResult } from "./result";
import { Result } from "pg";

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
  const interview = await prisma.interview.findFirst({
    where: {
      id: req.params.interviewId,
    },
    include: {
      conversation: true,
    },
  });

  if (!interview) {
    return res.status(411).json({
      message: "Interview not found",
    });
  }

  // Create mutable variables for our response
  let finalScore = interview.score;
  let finalFeedback = interview.feedback;
  let finalStatus = interview.status;

  // 🔒 STATE-BASED LOCKING MECHANISM
  // If status is not "Done", it's either "Pre" or "InProgress".
  // To prevent parallel polling requests from triggering Gemini simultaneously:
  if (interview.status !== "Done") {
    try {
      // 1. Atomically attempt to update status to "Processing"
      // This acts as a distributed lock across concurrent requests.
      const lockedInterview = await prisma.interview.updateMany({
        where: {
          id: req.params.interviewId,
          status: { not: "Done" } // Only update if someone else hasn't finished it
        },
        data: {
          status: "Done" // Mark it immediately so subsequent requests skip this block
        }
      });

      // If count is 1, this specific request won the race and gets to call Gemini
      if (lockedInterview.count > 0) {
        // 2. Run the heavy AI evaluation safely
        const result = await calculateResult(interview.conversation);
        
        // 3. Save the actual metrics back to the row
        await prisma.interview.update({
          where: { id: req.params.interviewId },
          data: {
            feedback: result.feedback,
            score: result.score,
          },
        });

        finalScore = result.score;
        finalFeedback = result.feedback;
        finalStatus = "Done";
      } else {
        // If count is 0, another concurrent request is already handling it.
        // We can just fetch the updated data or let the frontend poll again.
        const updatedInterview = await prisma.interview.findUnique({
          where: { id: req.params.interviewId }
        });
        finalScore = updatedInterview?.score!;
        finalFeedback = updatedInterview?.feedback!;
        finalStatus = updatedInterview?.status || "Done";
      }
    } catch (error) {
      console.error("Evaluation error:", error);
      // Fallback state if anything crashes
    }
  }

  // Send the data back AFTER we know it's successfully evaluated or secured
  res.json({
    score: finalScore,
    feedback: finalFeedback,
    status: finalStatus,
    transcript: interview.conversation.map((c) => ({
      type: c.type,
      content: c.message,
      createdAt: c.createdAt,
    })),
  });
});

app.listen(3001, () => {
  console.log("server is running");
});
