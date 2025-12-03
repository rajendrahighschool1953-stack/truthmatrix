// app/api/detect-news/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

/**
 * NOTE:
 * - Keeps consistent generateText usage as detect-deepfake.
 * - Returns a strict JSON object parsed from the model's output.
 */

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const body = await request.json();
    const text = (body?.text ?? "").toString();
    const source = (body?.source ?? "").toString();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Please provide text to analyze" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "Google Generative AI API key not configured" }, { status: 500 });
    }

    const analysisPrompt = `You are an expert fact-checker and misinformation detector. Analyze the following text/news article and provide a detailed assessment.

Text to analyze:
"${text.replace(/"/g, '\\"')}" 

${source ? `Source: ${source}\n\n` : ""}

Please provide your analysis in the following JSON format ONLY (no other text):
{
  "credibilityScore": <number 0-100 where 100 is most credible>,
  "classification": "<LIKELY_TRUE|LIKELY_FALSE|UNVERIFIABLE>",
  "confidence": <number 0-100>,
  "keyFindings": ["finding1","finding2","finding3"],
  "redFlags": ["flag1","flag2"],
  "factsToVerify": ["fact1","fact2"],
  "reasoning": "detailed explanation of assessment",
  "recommendations": ["recommendation1","recommendation2"]
}

Analyze for:
1. Logical consistency and coherence
2. Language patterns common in misinformation
3. Emotional manipulation techniques
4. Sensationalism or extraordinary claims
5. Missing sources or evidence
6. Bias indicators
7. Known false narratives
8. Contradictions with established facts
`;

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [{ role: "user", content: [{ type: "text", text: analysisPrompt }] }],
      temperature: 0.2,
      maxTokens: 1024,
    });

    const responseText = (result as any).text ?? "";

    // Extract JSON from the model's output
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
    console.error("Error in news detection:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze news content",
      },
      { status: 500 }
    );
  }
}
