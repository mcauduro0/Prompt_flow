/**
 * ARC Investment Factory - Monitoring Planner Agent
 */

export interface MonitoringPlan {
  kpis: string[];
  checkpoints: string[];
  triggers: string[];
}

export async function generateMonitoringPlan(): Promise<MonitoringPlan> {
  return {
    kpis: [],
    checkpoints: [],
    triggers: [],
  };
}

export default { generateMonitoringPlan };
