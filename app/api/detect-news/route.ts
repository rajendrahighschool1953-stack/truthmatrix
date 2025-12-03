import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text, source } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide text to analyze" },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: "Google Generative AI API key not configured" },
        { status: 500 }
      );
    }

    const analysisPrompt = `You are an expert fact-checker and misinformation detector. Analyze the following text/news article and provide a detailed assessment.

Text to analyze:
"${text}"

${source ? `Source: ${source}` : ""}

Please provide your analysis in the following JSON format ONLY (no other text):
{
  "credibilityScore": <number 0-100 where 100 is most credible>,
  "classification": "<LIKELY_TRUE, LIKELY_FALSE, or UNVERIFIABLE>",
  "confidence": <number 0-100>,
  "keyFindings": ["finding1", "finding2", "finding3"],
  "redFlags": ["flag1", "flag2"],
  "factsToVerify": ["fact1", "fact2"],
  "reasoning": "detailed explanation of assessment",
  "recommendations": ["recommendation1", "recommendation2"]
}

Analyze for:
1. Logical consistency and coherence
2. Language patterns common in misinformation
3. Emotional manipulation techniques
4. Sensationalism or extraordinary claims
5. Missing sources or evidence
6. Bias indicators
7. Known false narratives
8. Contradictions with established facts`;

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: analysisPrompt,
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
    console.error("Error in news detection:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze news content",
      },
      { status: 500 }
    );
  }
}
