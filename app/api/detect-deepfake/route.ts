import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";

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

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: "Google Generative AI API key not configured" },
        { status: 500 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

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

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            {
              type: "image",
              image: Buffer.from(base64Data, "base64"),
            },
          ],
        },
      ],
      temperature: 0.7,
      maxTokens: 1024,
    });

    const responseText = result.text;

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
