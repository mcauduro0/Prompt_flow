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
import { promptsRouter } from './routes/prompts.js';
import { portfolioRouter } from './routes/portfolio.js';
import { systemRouter } from './routes/system.js';
import { icMemosRouter } from './routes/ic-memos.js';
import { qaV2Router } from "./routes/qa-v2.js";
import { manualIdeasRouter } from './routes/manual-ideas.js';

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
app.use('/api/prompts', promptsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/system', systemRouter);
app.use('/api/ic-memos', icMemosRouter);
app.use("/api/qa-v2", qaV2Router);
app.use('/api/manual-ideas', manualIdeasRouter);

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
