import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import visitsRouter from './routes/visits.js';
import anomaliesRouter from './routes/anomalies.js';
import supervisorRouter from './routes/supervisor.js';
import phcRouter from './routes/phc.js';

// Environment Validation
if (!process.env.GEMINI_API_KEY) {
  console.error("CRITICAL ERROR: Missing GEMINI_API_KEY in .env — see .env.example");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/visits', visitsRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/supervisor-digest', supervisorRouter);
app.use('/api/phc-digest', phcRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong',
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
