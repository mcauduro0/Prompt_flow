/**
 * ARC Investment Factory - Locked Parameters Unit Tests
 * 
 * These tests assert that locked parameters cannot be changed accidentally.
 * Any change to these values requires explicit approval.
 */

import { describe, it, expect } from 'vitest';
import {
  ASSET_CLASS,
  DEFAULT_OPTIMIZATION,
  LANE_A_DAILY_TARGET,
  LANE_A_DAILY_CAP,
  LANE_B_DAILY_PROMOTIONS_TARGET,
  LANE_B_DAILY_PROMOTIONS_MAX,
  LANE_B_WEEKLY_DEEP_PACKETS,
  LANE_B_MAX_CONCURRENCY,
  NOVELTY_NEW_TICKER_DAYS,
  NOVELTY_PENALTY_WINDOW_DAYS,
  SYSTEM_TIMEZONE,
  SCHEDULES,
  RANKING_WEIGHTS,
} from '../constants/index.js';

describe('Locked Parameters', () => {
  describe('Asset Class and Optimization', () => {
    it('should use global equities as asset class', () => {
      expect(ASSET_CLASS).toBe('global_equities');
    });

    it('should use novelty-first optimization', () => {
      expect(DEFAULT_OPTIMIZATION).toBe('novelty_first');
    });
  });

  describe('Lane A Parameters', () => {
    it('should target 120 ideas daily', () => {
      expect(LANE_A_DAILY_TARGET).toBe(120);
    });

    it('should cap at 200 tickers for enrichment', () => {
      expect(LANE_A_DAILY_CAP).toBe(200);
    });
  });

  describe('Lane B Parameters', () => {
    it('should target 2-3 promotions daily (max 4)', () => {
      expect(LANE_B_DAILY_PROMOTIONS_TARGET).toBeGreaterThanOrEqual(2);
      expect(LANE_B_DAILY_PROMOTIONS_TARGET).toBeLessThanOrEqual(3);
      expect(LANE_B_DAILY_PROMOTIONS_MAX).toBe(4);
    });

    it('should hard cap at 10 deep packets per week', () => {
      expect(LANE_B_WEEKLY_DEEP_PACKETS).toBe(10);
    });

    it('should limit concurrency to 3', () => {
      expect(LANE_B_MAX_CONCURRENCY).toBe(3);
    });
  });

  describe('Novelty Windows', () => {
    it('should consider ticker new if not seen in 90 days', () => {
      expect(NOVELTY_NEW_TICKER_DAYS).toBe(90);
    });

    it('should apply repetition penalty within 30 days', () => {
      expect(NOVELTY_PENALTY_WINDOW_DAYS).toBe(30);
    });
  });

  describe('Schedule Configuration', () => {
    it('should use America/Sao_Paulo timezone', () => {
      expect(SYSTEM_TIMEZONE).toBe('America/Sao_Paulo');
    });

    it('should run Lane A at 06:00 weekdays only', () => {
      expect(SCHEDULES.LANE_A_CRON).toBe('0 6 * * 1-5');
      expect(SCHEDULES.LANE_A_HOUR).toBe(6);
    });

    it('should run Lane B at 08:00 weekdays only', () => {
      expect(SCHEDULES.LANE_B_CRON).toBe('0 8 * * 1-5');
      expect(SCHEDULES.LANE_B_HOUR).toBe(8);
    });
  });

  describe('Ranking Weights', () => {
    it('should weight novelty at 0.45 for display ranking', () => {
      expect(RANKING_WEIGHTS.NOVELTY_SCORE).toBe(0.45);
    });

    it('should use additive weights that sum appropriately', () => {
      const positiveWeights = 
        RANKING_WEIGHTS.NOVELTY_SCORE +
        RANKING_WEIGHTS.EDGE_CLARITY +
        RANKING_WEIGHTS.VALUATION_TENSION +
        RANKING_WEIGHTS.CATALYST_TIMING +
        RANKING_WEIGHTS.BUSINESS_QUALITY_PRIOR;
      
      const negativeWeights = 
        Math.abs(RANKING_WEIGHTS.REPETITION_PENALTY) +
        Math.abs(RANKING_WEIGHTS.DISCLOSURE_FRICTION_PENALTY);
      
      // Positive weights should sum to ~0.90
      expect(positiveWeights).toBeCloseTo(0.90, 2);
      
      // Negative weights should sum to ~0.10
      expect(negativeWeights).toBeCloseTo(0.10, 2);
    });
  });
});

describe('Parameter Relationships', () => {
  it('daily target should be less than daily cap', () => {
    expect(LANE_A_DAILY_TARGET).toBeLessThan(LANE_A_DAILY_CAP);
  });

  it('daily promotions target should be less than max', () => {
    expect(LANE_B_DAILY_PROMOTIONS_TARGET).toBeLessThan(LANE_B_DAILY_PROMOTIONS_MAX);
  });

  it('weekly limit should accommodate max daily promotions', () => {
    // 5 weekdays * max 4 = 20, but hard cap is 10
    expect(LANE_B_WEEKLY_DEEP_PACKETS).toBeLessThanOrEqual(LANE_B_DAILY_PROMOTIONS_MAX * 5);
  });

  it('novelty new threshold should be greater than penalty window', () => {
    expect(NOVELTY_NEW_TICKER_DAYS).toBeGreaterThan(NOVELTY_PENALTY_WINDOW_DAYS);
  });
});
