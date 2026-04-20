import { AIPredictionResult } from "../types";

interface GeminiCandidatePart {
  text?: string;
}

interface GeminiCandidateContent {
  parts?: GeminiCandidatePart[];
}

interface GeminiCandidate {
  content?: GeminiCandidateContent;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

const buildPrompt = (homeTeam: string, awayTeam: string): string => {
  return [
    "You are a football analyst assistant.",
    `Predict the score for a soccer match between ${homeTeam} and ${awayTeam}.`,
    "Return only valid JSON in this shape:",
    '{"homeScore": number, "awayScore": number, "reasoning": string}',
    "Reasoning must be in Brazilian Portuguese with max 30 words.",
  ].join("\n");
};

const sanitizePrediction = (input: any): AIPredictionResult | null => {
  if (!input || typeof input !== "object") return null;

  const homeScore = Number(input.homeScore);
  const awayScore = Number(input.awayScore);
  const reasoning = String(input.reasoning ?? "").trim();

  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (!reasoning) return null;

  return {
    homeScore: Math.max(0, Math.round(homeScore)),
    awayScore: Math.max(0, Math.round(awayScore)),
    reasoning,
  };
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gemini API key is not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let body: { homeTeam?: string; awayTeam?: string } = {};
  try {
    body = (await req.json()) as { homeTeam?: string; awayTeam?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const homeTeam = String(body.homeTeam ?? "").trim();
  const awayTeam = String(body.awayTeam ?? "").trim();

  if (!homeTeam || !awayTeam) {
    return new Response(
      JSON.stringify({ error: "homeTeam and awayTeam are required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildPrompt(homeTeam, awayTeam) }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
      },
    );

    const responseText = await geminiResponse.text();

    if (!geminiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Gemini request failed",
          status: geminiResponse.status,
          details: responseText,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let parsedGemini: GeminiResponse;
    try {
      parsedGemini = JSON.parse(responseText) as GeminiResponse;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid Gemini response payload" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const text = parsedGemini.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Gemini returned empty content" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let parsedPrediction: unknown;
    try {
      parsedPrediction = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "Gemini output is not valid JSON" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const prediction = sanitizePrediction(parsedPrediction);
    if (!prediction) {
      return new Response(
        JSON.stringify({ error: "Gemini output missing expected fields" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(prediction), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Internal error while calling Gemini",
        message: error?.message ?? "unknown",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
