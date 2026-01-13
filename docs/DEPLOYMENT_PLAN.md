# ARC Investment Factory - Production Deployment Plan

**Author:** Manus AI
**Date:** January 12, 2026

## 1. Executive Summary

This document outlines a comprehensive plan for deploying the ARC Investment Factory to a production environment. It covers hosting options, a recommended architecture, CI/CD pipeline setup, and estimated costs. The primary goal is to establish a scalable, secure, and cost-effective infrastructure that supports the entire ARC ecosystem, including the Next.js frontend, Express API backend, and the background worker process.

## 2. Architecture Overview

The ARC system is a monorepo composed of three main services:

- **Web App (`apps/web`):** A Next.js application serving the user interface.
- **API Server (`apps/api`):** An Express.js server providing backend endpoints for the web app.
- **Worker (`packages/worker`):** A background process that executes the investment analysis pipelines (Lanes A & B).

These services are interdependent and require a coordinated deployment strategy.

## 3. Hosting Options Analysis

We evaluated three leading cloud platforms based on their suitability for a Node.js-based monorepo architecture, ease of use, scalability, and cost.

| Platform | Pros | Cons | Cost (Est.) |
|---|---|---|---|
| **Vercel** | - Seamless Next.js integration [1]<br>- Automatic CI/CD from Git<br>- Serverless functions for API | - Less control over backend environment<br>- Can be expensive at scale | $20/user/month |
| **AWS (ECS + RDS)** | - Full control and scalability<br>- Mature ecosystem<br>- Wide range of services | - High complexity and setup effort<br>- Steeper learning curve | $50-100/month+ |
| **Railway** | - Simple, Git-based deployment [2]<br>- Automatic service discovery<br>- Usage-based pricing | - Newer platform, fewer features than AWS<br>- Can be less cost-effective for high CPU tasks | $30-70/month |

### 3.1. Recommendation: Vercel + Railway

For an optimal balance of performance, ease of use, and cost-effectiveness, we recommend a hybrid approach:

- **Frontend (Web App):** Deploy to **Vercel**. Its infrastructure is purpose-built for Next.js, providing unparalleled performance, automatic image optimization, and a global CDN.
- **Backend (API & Worker):** Deploy to **Railway**. Its simple, container-based approach is ideal for the Express API and the long-running worker process. It offers easy scaling and a more predictable cost structure for backend services.

This hybrid model leverages the best of both platforms, ensuring a world-class user experience via Vercel and a robust, scalable backend via Railway.

## 4. Detailed Deployment Plan (Vercel + Railway)

This section provides a step-by-step guide to deploying the ARC Investment Factory.

### 4.1. Prerequisites

1. **GitHub Repository:** Code hosted on GitHub.
2. **Vercel Account:** Pro plan ($20/month).
3. **Railway Account:** Pro plan (starts at $20/month).
4. **Domain Name:** A custom domain (e.g., `arc.investments`).

### 4.2. Step 1: Configure Environment Variables

Create a `.env.production` file with all necessary API keys and secrets. This file will be used to configure the environments on Vercel and Railway.

```
# LLM API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...

# Data Provider Keys
POLYGON_API_KEY=...
FMP_API_KEY=...
FRED_API_KEY=...
FISCAL_AI_API_KEY=...

# System
DATABASE_URL=postgresql://...
```

### 4.3. Step 2: Deploy Frontend to Vercel

1. **Import Project:** In the Vercel dashboard, import the GitHub repository.
2. **Configure Project:**
   - **Framework Preset:** Next.js (will be auto-detected).
   - **Root Directory:** `apps/web`.
   - **Build Command:** `pnpm build`.
   - **Environment Variables:** Copy the contents of `.env.production` into the Vercel project settings.
3. **Deploy:** Click "Deploy". Vercel will automatically build and deploy the frontend.
4. **Add Domain:** Assign your custom domain to the Vercel project.

### 4.4. Step 3: Deploy Backend to Railway

Railway uses a `railway.json` file to define services. We will create this file to configure the API and Worker.

1. **Create `railway.json`:** Add this file to the root of the repository (details in Section 5).
2. **Import Project:** In the Railway dashboard, create a new project and link it to the GitHub repository.
3. **Configure Services:** Railway will automatically detect the services from `railway.json`.
   - **API Service:** An Express server.
   - **Worker Service:** A background process.
4. **Add Database:** Add a PostgreSQL database service within the Railway project.
5. **Environment Variables:**
   - Copy the contents of `.env.production` to the Railway project variables.
   - Railway will automatically inject the `DATABASE_URL` from the PostgreSQL service.
6. **Deploy:** Railway will build and deploy the services upon every `git push` to the `main` branch.

### 4.5. Step 4: CI/CD (Continuous Integration / Continuous Deployment)

Both Vercel and Railway integrate directly with GitHub, providing a seamless CI/CD pipeline out of the box.

- **On `git push` to `main`:**
  - Vercel automatically builds and deploys the frontend.
  - Railway automatically builds and deploys the backend API and worker.
- **On Pull Request:**
  - Vercel creates a preview deployment for the frontend.
  - Railway can be configured to create preview environments for the backend.

## 5. Configuration Files

### 5.1. `railway.json`

This file defines the services to be deployed on Railway.

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "services": [
    {
      "name": "api",
      "builder": "nixpacks",
      "nixpacks": {
        "startCmd": "pnpm --filter @arc/api start"
      },
      "healthcheck": {
        "path": "/api/health",
        "port": 3001
      }
    },
    {
      "name": "worker",
      "builder": "nixpacks",
      "nixpacks": {
        "startCmd": "pnpm --filter @arc/worker start"
      }
    }
  ]
}
```

### 5.2. `vercel.json`

This file configures the Vercel deployment and sets up rewrites to proxy API requests to the Railway backend, avoiding CORS issues.

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://arc-api.up.railway.app/:path*"
    }
  ]
}
```

## 6. Estimated Monthly Costs

| Service | Provider | Plan | Cost |
|---|---|---|---|
| Web App | Vercel | Pro | $20.00 |
| API Server | Railway | Pro | ~$15.00 |
| Worker | Railway | Pro | ~$20.00 |
| Database | Railway | Pro | ~$10.00 |
| **Total** | | | **~$65.00/month** |

*Note: Costs are estimates and will vary based on actual usage.*

## 7. References

[1] Vercel. "Next.js on Vercel." [Online]. Available: https://vercel.com/next.js
[2] Railway. "Railway Docs." [Online]. Available: https://docs.railway.app/
