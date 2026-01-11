/**
 * ARC Investment Factory - Health Routes
 */

import { Router } from 'express';
import { checkDatabaseConnection } from '@arc/database';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();

  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
    },
  });
});

healthRouter.get('/ready', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();

  if (dbHealthy) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Database not connected' });
  }
});
