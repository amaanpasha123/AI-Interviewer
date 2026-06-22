import { BACKEND_URL } from "@/lib/config";
import { Content } from "@radix-ui/react-select";
import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

interface Result {
  transcript: {
    type: "Assistant" | "User";
    content: string;
    createdAt: Date;
  }[];
  score: number;
  feedback: string;
}

export function Result() {
  const { interviewId } = useParams();
  const [result, setResult] = useState<Result>({
    score: 0,
    feedback: "",
    transcript: [],
  });

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/v1/result/${interviewId}`)
      .then((response) => {
        setResult(response.data);
      });

    let intervalId = setInterval(() => {
      axios
        .get(`${BACKEND_URL}/api/v1/result/${interviewId}`)
        .then((response) => {
          setResult(response.data);
        });
    }, 5 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [interviewId]);

  return (
    <div>
      Score - {result.score}
      Feedback - {result.feedback}
      Transcript - 
      {result.transcript
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((x) => (
          <div>
            {x.type} - {x.content}
          </div>
        ))}
    </div>
  );
}
