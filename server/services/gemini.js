import { GoogleGenerativeAI } from '@google/generative-ai';
import { checklists } from '../config/checklists.js';

let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

export async function transcribeAndExtract(audioBuffer, mimeType, visitType, isRetry = false) {
  if (!genAI) {
    throw new Error("Gemini API not configured properly.");
  }

  const checklistFields = checklists[visitType] || [];
  const checklistStr = checklistFields.join(", ");

  const prompt = `You are processing a voice note recorded by an ASHA/ANM community health worker in India immediately after a home visit. The worker may speak in Kannada, Hindi, English, or a mix of these languages.

Your task:
1. Transcribe the audio accurately, preserving the original language(s) spoken.
2. Extract structured information from the transcript based on the visit type: ${visitType}.
3. For this visit type, the required fields to check for are: ${checklistStr}.
4. If a required field is not mentioned in the voice note, set its value to null — do not guess or fabricate data.
5. Flag the visit as "complete" only if ALL required fields for this visit type are present and non-null. Otherwise flag as "incomplete" and list which fields are missing.
6. If the audio contains no discernible human speech, or is silent/empty, respond with transcript: "", status: "error", and do not invent any names, numbers, or medical details under any circumstances.

Respond with ONLY valid JSON in this exact structure, no markdown formatting, no extra text:
{
  "transcript": "string - the transcribed text",
  "visit_type": "string",
  "extracted_fields": { ...key-value pairs matching the checklist... },
  "status": "complete" | "incomplete",
  "missing_fields": ["array of field names that are null, empty if complete"]
}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite"  });

    const audioPart = {
      inlineData: {
        data: audioBuffer.toString("base64"),
        mimeType
      }
    };

    const result = await model.generateContent([prompt, audioPart]);
    const responseText = result.response.text();

    if (process.env.NODE_ENV !== 'production') {
      console.log("--- RAW GEMINI RESPONSE ---");
      console.log(responseText);
      console.log("---------------------------");
    }

    // Try parsing the JSON
    try {
      // Strip markdown fences if present
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", parseError);
      return {
        transcript: null,
        visit_type: visitType,
        extracted_fields: {},
        status: "error",
        missing_fields: [],
        error: "Failed to parse AI response"
      };
    }

  } catch (error) {
    if (!isRetry) {
      console.warn("Gemini API call failed, retrying in 1 second...", error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return transcribeAndExtract(audioBuffer, mimeType, visitType, true);
    } else {
      console.error("Gemini API call failed after retry:", error);
      throw new Error("Failed to process audio with AI after retry.");
    }
  }
}

