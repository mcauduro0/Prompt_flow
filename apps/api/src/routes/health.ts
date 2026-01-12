/**
 * ARC Investment Factory - Health Routes
 */

import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '@arc/database';

export const healthRouter: Router = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseConnection();

  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
    },
  });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseConnection();

  if (dbHealthy) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Database not connected' });
  }
});
