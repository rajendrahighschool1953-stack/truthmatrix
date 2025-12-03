// app/api/detect-deepfake/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

/**
 * NOTE:
 * - This file assumes the server runtime supports Buffer (Node runtime).
 * - If you're deploying to Edge runtime, replace Buffer usage and ensure SDK supports Edge or switch runtime to "nodejs":
 *   export const runtime = "nodejs";
 */

export async function POST(request: NextRequest) {
  try {
    // Ensure content-type is multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as unknown as File | null;
    const description = (formData.get("description") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "Please provide an image file" }, { status: 400 });
    }

    // Optionally check file type
    // file.type may be empty depending on client; guard against non-image uploads
    if (file && typeof (file as any).type === "string" && !(file as any).type.startsWith("image/")) {
      return NextResponse.json({ error: "Uploaded file must be an image" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "Google Generative AI API key not configured" }, { status: 500 });
    }

    // convert file to base64
    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    // Build analysis prompt — request strict JSON output
    const analysisPrompt = `You are an expert in detecting deepfakes, AI-generated images, and manipulated media. Analyze this image for signs of manipulation, AI generation, or deepfake indicators.

${description ? `Additional context: ${description}\n\n` : ""}

The image will be provided as base64 inside the prompt. Do NOT produce any text other than the exact JSON object described below.

Image base64 (do not print anything else): "${base64Data}"

Provide your analysis in ONLY the following JSON format (no other text):
{
  "authenticityScore": <number 0-100 where 100 is most authentic>,
  "classification": "<AUTHENTIC|LIKELY_FAKE|AI_GENERATED|MANIPULATED>",
  "confidence": <number 0-100>,
  "deepfakeIndicators": ["indicator1","indicator2"],
  "aiGenerationSigns": ["sign1","sign2"],
  "manipulationSigns": ["sign1","sign2"],
  "analysisDetails": {
    "faceAnalysis": "detailed face analysis",
    "textureAnalysis": "texture and skin analysis",
    "lightingAnalysis": "lighting consistency",
    "eyeAnalysis": "eye and pupil analysis",
    "hairAnalysis": "hair and fur analysis",
    "shadowAnalysis": "shadow consistency",
    "backgroundAnalysis": "background coherence"
  },
  "reasoning": "detailed explanation",
  "recommendations": ["recommendation1","recommendation2"]
}

Look for:
1. Facial recognition anomalies
2. Eyes (pupils, iris patterns, eye whites consistency)
3. Hair texture and movement consistency
4. Skin tone irregularities
5. Lighting inconsistencies
6. Shadow anomalies
7. Face warping or distortion
8. Unnatural blinking patterns
9. AI-generated artifacts
10. Compression artifacts indicating manipulation
11. Background coherence
12. Reflection anomalies
`;

    // Call the AI SDK consistently. Keep temperature low for deterministic analysis.
    const result = await generateText({
      model: google("gemini-2.5-flash"),
      // send the prompt as a single user message
      messages: [{ role: "user", content: [{ type: "text", text: analysisPrompt }] }],
      temperature: 0.2,
    });

    // result.text is expected; be defensive
    const responseText = (result as any).text ?? "";

    // Try to extract JSON object
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        {
          error: "Failed to parse AI response — no JSON object found",
          rawResponse: responseText,
        },
        { status: 500 }
      );
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return NextResponse.json(
        {
          error: "Failed to parse JSON from AI response",
          rawResponse: responseText,
          parseError: (parseErr as Error).message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in deepfake detection:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze image",
      },
      { status: 500 }
    );
  }
}
