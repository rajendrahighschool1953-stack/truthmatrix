import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function imageToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const description = (formData.get("description") as string) || "";

    if (!file) {
      return NextResponse.json(
        { error: "Please provide an image file" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type || "image/jpeg",
      },
    };

    const analysisPrompt = `You are an expert in detecting deepfakes, AI-generated images, and manipulated media. Analyze this image for signs of manipulation, AI generation, or deepfake indicators.

${description ? `Additional context: ${description}` : ""}

Provide your analysis in ONLY the following JSON format (no other text):
{
  "authenticityScore": <number 0-100 where 100 is most authentic>,
  "classification": "<AUTHENTIC, LIKELY_FAKE, AI_GENERATED, or MANIPULATED>",
  "confidence": <number 0-100>,
  "deepfakeIndicators": ["indicator1", "indicator2"],
  "aiGenerationSigns": ["sign1", "sign2"],
  "manipulationSigns": ["sign1", "sign2"],
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
  "recommendations": ["recommendation1", "recommendation2"]
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
12. Reflection anomalies`;

    const result = await model.generateContent([analysisPrompt, imagePart]);
    const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          rawResponse: responseText,
        },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in deepfake detection:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze image",
      },
      { status: 500 }
    );
  }
}
