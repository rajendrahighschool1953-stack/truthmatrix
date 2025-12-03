// app/api/detect-deepfake/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const description = formData.get("description")?.toString() || "";

    if (!file) {
      return NextResponse.json({ error: "Image file required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const prompt = `
You are an expert deepfake detector.
Analyze the image and reply ONLY with valid JSON:

{
  "authenticityScore": number,
  "classification": "AUTHENTIC" | "LIKELY_FAKE" | "AI_GENERATED" | "MANIPULATED",
  "confidence": number,
  "deepfakeIndicators": [],
  "aiGenerationSigns": [],
  "manipulationSigns": [],
  "analysisDetails": {
    "faceAnalysis": "",
    "textureAnalysis": "",
    "lightingAnalysis": "",
    "eyeAnalysis": "",
    "hairAnalysis": "",
    "shadowAnalysis": "",
    "backgroundAnalysis": ""
  },
  "reasoning": "",
  "recommendations": []
}
    `;

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: uint8 }
          ]
        }
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
    console.error("detect-deepfake ERROR:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
