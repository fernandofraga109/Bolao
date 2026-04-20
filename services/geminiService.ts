import { AIPredictionResult } from "../types";

export const getAIPrediction = async (
  homeTeam: string,
  awayTeam: string,
): Promise<AIPredictionResult | null> => {
  try {
    const response = await fetch("/api/gemini-prediction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ homeTeam, awayTeam }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error("Gemini endpoint error:", payload);
      return null;
    }

    const payload = (await response.json()) as AIPredictionResult;

    if (
      typeof payload.homeScore !== "number" ||
      typeof payload.awayScore !== "number" ||
      typeof payload.reasoning !== "string"
    ) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Error fetching AI prediction:", error);
    return null;
  }
};
