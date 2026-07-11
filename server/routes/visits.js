import express from 'express';
import multer from 'multer';
import { transcribeAndExtract } from '../services/gemini.js';
import { saveVisitData, getVisits } from '../services/firestore.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/visits - Fetch recent visits
router.get('/', async (req, res, next) => {
  try {
    const visits = await getVisits();
    res.json(visits);
  } catch (error) {
    next(error);
  }
});

// POST /api/visits/audio - Process audio from frontend
router.post('/audio', upload.single('audio'), async (req, res, next) => {
  try {
    const audioFile = req.file;
    const visitType = req.body.visitType || 'general';

    if (!audioFile) {
      return res.status(400).json({ success: false, error: "No audio file provided." });
    }

    if (audioFile.size < 5000) {
      return res.status(400).json({ success: false, error: "Audio too short or empty — please record a longer message." });
    }

    // Call Gemini
    const extractionResult = await transcribeAndExtract(audioFile.buffer, audioFile.mimetype, visitType);

    if (extractionResult.status === 'error' || !extractionResult.transcript || extractionResult.transcript.trim() === '') {
      return res.status(400).json({
        success: false,
        error: "Failed to extract valid speech. Please try again."
      });
    }

    // Save to Firestore (Stubbed fallback)
    const savedDoc = await saveVisitData({
      visitType,
      ...extractionResult
    });

    res.json({
      success: true,
      visitId: savedDoc.id,
      data: extractionResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;
