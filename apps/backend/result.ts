import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const outputSchema = z.object({
    feedback: z.string().describe("Feedback for the user"),
    score: z.number().int().describe("Score out of 10 for their interview"), // ✅ Fixed: z.number().int()
});

const RESULT_PROMPT = `
    You are an expert evaluator. Your job is to evaluate the user's interview based on the provided transcript. 
    Give them a score out of 10 and also provide constructive feedback.

    {{USER_TRANSCRIPT}}
`;

export async function calculateResult(messages: { type: "Assistant" | "User", message: string, createdAt: Date }[]) {
    // Convert the Zod schema cleanly into a JSON schema for Gemini
    const jsonSchema = zodToJsonSchema(outputSchema as any);

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash", // ✅ Fixed: model name string
        contents: RESULT_PROMPT.replace(`{{USER_TRANSCRIPT}}`, JSON.stringify(messages)),
        config: {
            // ✅ Fixed: Migrated configuration structure to match current SDK spec
            responseMimeType: "application/json",
            responseSchema: jsonSchema as any, 
        },
    });

    console.log("Raw Gemini Response:", response.text);

    if (!response.text) {
        throw new Error("Gemini returned an empty response text.");
    }

    // Safely parse and validate the JSON object
    const parsedData = JSON.parse(response.text.trim());
    const result = outputSchema.parse(parsedData);
    
    return result;
}