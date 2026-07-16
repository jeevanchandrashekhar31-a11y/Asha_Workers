import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import { getAllVisits } from '../services/firestore.js';
import { runAnomalyDetection } from '../services/anomalyDetection.js';

export const getAnomalyReportTool = new FunctionTool({
  name: 'get_anomaly_report',
  description: 'Fetches all visits, runs anomaly detection, and returns the anomaly report.',
  parameters: z.object({}),
  async execute() {
    try {
      const visits = await getAllVisits();
      const anomalies = await runAnomalyDetection(visits);
      return anomalies;
    } catch (err) {
      console.error("Error in get_anomaly_report tool:", err);
      return { status: 'error', message: String(err) };
    }
  }
});

export const supervisorAgent = new LlmAgent({
  name: 'supervisor_agent',
  model: 'gemini-3.1-flash-lite',
  tools: [getAnomalyReportTool],
  instruction: "Review the anomaly report and produce a short plain-language digest a PHC supervisor could read in 10 seconds. Flag counts by rule type — don't just repeat the raw JSON.",
});
