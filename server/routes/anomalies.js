import express from 'express';
import { getAllVisits } from '../services/firestore.js';
import { runAnomalyDetection } from '../services/anomalyDetection.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const visits = await getAllVisits();
    const anomalies = runAnomalyDetection(visits);
    
    res.json({
      totalVisits: visits.length,
      anomalyCount: anomalies.length,
      anomalies
    });
  } catch (error) {
    console.error("Error in anomaly detection route:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error during anomaly detection"
    });
  }
});

export default router;
