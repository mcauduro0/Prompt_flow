/**
 * ARC Investment Factory - Configuration
 * Environment-based configuration with validation
 */

import { config } from 'dotenv';

// Load environment variables
config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarOptional(key: string): string | undefined {
  return process.env[key];
}

function getEnvVarNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

export const appConfig = {
  // Environment
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // Database
  database: {
    url: getEnvVar('DATABASE_URL', 'postgresql://localhost:5432/arc_investment_factory'),
    directUrl: getEnvVarOptional('DIRECT_URL'),
  },

  // Vector Database (Pinecone)
  pinecone: {
    apiKey: getEnvVarOptional('PINECONE_API_KEY'),
    environment: getEnvVarOptional('PINECONE_ENVIRONMENT'),
    indexName: getEnvVar('PINECONE_INDEX_NAME', 'docs_global'),
  },

  // Object Storage (S3)
  s3: {
    bucket: getEnvVar('S3_BUCKET', 'arc-investment-factory'),
    region: getEnvVar('S3_REGION', 'us-east-1'),
    accessKeyId: getEnvVarOptional('S3_ACCESS_KEY_ID'),
    secretAccessKey: getEnvVarOptional('S3_SECRET_ACCESS_KEY'),
  },

  // LLM Provider
  openai: {
    apiKey: getEnvVarOptional('OPENAI_API_KEY'),
    model: getEnvVar('OPENAI_MODEL', 'gpt-5.2'),
    baseUrl: getEnvVarOptional('OPENAI_API_BASE'),
  },

  // LLM Tracing (Langfuse)
  langfuse: {
    publicKey: getEnvVarOptional('LANGFUSE_PUBLIC_KEY'),
    secretKey: getEnvVarOptional('LANGFUSE_SECRET_KEY'),
    host: getEnvVar('LANGFUSE_HOST', 'https://cloud.langfuse.com'),
  },

  // Error Tracking (Sentry)
  sentry: {
    dsn: getEnvVarOptional('SENTRY_DSN'),
  },

  // Redis
  redis: {
    url: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
  },

  // Application Ports
  ports: {
    api: getEnvVarNumber('API_PORT', 3001),
    web: getEnvVarNumber('WEB_PORT', 3000),
  },

  // Operating Parameters (can be overridden via env)
  operatingParams: {
    laneADailyTarget: getEnvVarNumber('LANE_A_DAILY_TARGET', 120),
    laneADailyCap: getEnvVarNumber('LANE_A_DAILY_CAP', 200),
    laneBDailyPromotions: getEnvVarNumber('LANE_B_DAILY_PROMOTIONS', 3),
    laneBWeeklyCap: getEnvVarNumber('LANE_B_WEEKLY_CAP', 10),
    laneBMaxConcurrency: getEnvVarNumber('LANE_B_MAX_CONCURRENCY', 3),
  },
} as const;

export type AppConfig = typeof appConfig;
