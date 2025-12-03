// app/api/detect-news/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(request: NextRequest) {
  try {
    const { text, source } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Please provide text to analyze" }, { status: 400 });
    }

    const prompt = `
You are an expert misinformation detector.
Analyze the text below and respond ONLY with valid JSON.

TEXT:
${text}

SOURCE:
${source || "unknown"}

JSON ONLY:
{
  "credibilityScore": number,
  "classification": "LIKELY_TRUE" | "LIKELY_FALSE" | "UNVERIFIABLE",
  "confidence": number,
  "keyFindings": [],
  "redFlags": [],
  "factsToVerify": [],
  "reasoning": "",
  "recommendations": []
}
    `;

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [
        { role: "user", content: [{ type: "text", text: prompt }] }
      ],
      temperature: 0.2,
    });

    const raw = result.text;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No JSON found", raw }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ success: true, analysis, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error("detect-news ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
