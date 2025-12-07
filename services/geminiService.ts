import { GoogleGenAI, Type } from "@google/genai";
import { AIPredictionResult } from "../types";

// Helper to get safe API key
const getApiKey = (): string | undefined => {
  return process.env.API_KEY;
};

export const getAIPrediction = async (
  homeTeam: string,
  awayTeam: string
): Promise<AIPredictionResult | null> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("API Key missing for Gemini");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Predict the score for a soccer match between ${homeTeam} and ${awayTeam}. Provide a realistic score and a very brief tactical reason in Brazilian Portuguese (max 30 words).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            homeScore: { type: Type.INTEGER },
            awayScore: { type: Type.INTEGER },
            reasoning: { type: Type.STRING },
          },
          required: ["homeScore", "awayScore", "reasoning"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text) as AIPredictionResult;
    return data;
  } catch (error) {
    console.error("Error fetching AI prediction:", error);
    return null;
  }
};