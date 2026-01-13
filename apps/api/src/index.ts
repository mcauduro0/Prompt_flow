/**
 * ARC Investment Factory - API Server
 * Express API for the investment research platform
 */

import express from 'express';
import cors from 'cors';
import { checkDatabaseConnection } from '@arc/database';
import { ideasRouter } from './routes/ideas.js';
import { researchRouter } from './routes/research.js';
import { runsRouter } from './routes/runs.js';
import { healthRouter } from './routes/health.js';
import { qaRouter } from './routes/qa.js';
import { memoryRouter } from './routes/memory.js';
import { telemetryRouter } from './routes/telemetry.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/research', researchRouter);
app.use('/api/runs', runsRouter);
app.use('/api/qa', qaRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/telemetry', telemetryRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Start server
async function start() {
  // Check database connection
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}

start();
