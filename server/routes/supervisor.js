import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllVisits } from '../services/firestore.js';
import { runAnomalyDetection } from '../services/anomalyDetection.js';

const router = express.Router();
const APP_NAME = "supervisorAgent";

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
    const anomalies = runAnomalyDetection(visits);

    const prompt = `Here is an anomaly report in JSON: ${JSON.stringify(anomalies)}. Produce a short, direct, 1-2 sentence plain-language digest for a PHC supervisor. Flag counts by rule type, do not repeat the raw JSON. Keep the tone professional, concise, and do not use any emojis.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ digest: responseText });
  } catch (error) {
    console.error("Error generating supervisor digest:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
