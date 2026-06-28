import dotenv from "dotenv";
dotenv.config({ override: true });

import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export const generateWithGroq = async (
  systemPrompt: string,
  userPrompt: string,
  retries = 2
): Promise<string> => {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"];
  let modelIndex = 0;

  const execute = async (remaining: number): Promise<string> => {
    try {
      const response = await groq.chat.completions.create({
        model: models[modelIndex],
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      });
      return response.choices[0]?.message?.content || "{}";
    } catch (error: any) {
      const errorString = error?.message || "";
      const isRateLimit = errorString.includes("429") || errorString.includes("rate_limit");
      const isModelUnavailable = errorString.includes("model") && errorString.includes("unavailable");

      if (isModelUnavailable) {
        modelIndex = Math.min(modelIndex + 1, models.length - 1);
      }

      if ((isRateLimit || isModelUnavailable) && remaining > 0) {
        const delay = isRateLimit ? 3000 : 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return execute(remaining - 1);
      }
      throw error;
    }
  };

  return execute(retries);
};
