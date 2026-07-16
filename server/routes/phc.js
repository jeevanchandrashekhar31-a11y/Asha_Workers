import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllVisits } from '../services/firestore.js';
import { aggregateVisitsByZone } from '../services/anomalyDetection.js';

const router = express.Router();

let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

router.get('/', async (req, res) => {
  try {
    if (!genAI) {
      throw new Error("Gemini API not configured properly.");
    }

    const visits = await getAllVisits();
    const aggregated = aggregateVisitsByZone(visits);

    console.log("PHC Zone Digest - Aggregated Data:", JSON.stringify(aggregated, null, 2));

    if (aggregated.length === 0) {
      return res.json({ digest: "No visit data available yet." });
    }

    const prompt = `Here is visit data grouped by zone in JSON: ${JSON.stringify(aggregated)}. Produce a short, direct, 1-2 sentence plain-language summary for a PHC official. Highlight any zones with notably low visit counts or high incomplete rates relative to others. Keep the tone professional, concise, and do not use any emojis.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ digest: responseText });
  } catch (error) {
    console.error("Error generating PHC digest:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
