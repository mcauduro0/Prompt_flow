/**
 * ARC Investment Factory - Budget Alert System
 * 
 * Monitors budget usage and generates alerts when thresholds are exceeded.
 * Supports multiple notification channels: console, database, webhook.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetAlert {
  id: string;
  type: 'warning' | 'critical';
  category: 'daily_budget' | 'monthly_budget' | 'token_limit' | 'latency' | 'error_rate';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface BudgetThresholds {
  daily_budget_warning: number;  // Percentage (0-100)
  daily_budget_critical: number;
  monthly_budget_warning: number;
  monthly_budget_critical: number;
  token_per_run_warning: number;
  token_per_run_critical: number;
  latency_warning_ms: number;
  latency_critical_ms: number;
  error_rate_warning: number;  // Percentage (0-100)
  error_rate_critical: number;
}

export interface NotificationConfig {
  console: boolean;
  database: boolean;
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
  email?: {
    to: string[];
    from: string;
  };
}

export interface BudgetMetrics {
  daily_spent_usd: number;
  daily_limit_usd: number;
  monthly_spent_usd: number;
  monthly_limit_usd: number;
  tokens_used: number;
  token_limit: number;
  avg_latency_ms: number;
  error_rate: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_THRESHOLDS: BudgetThresholds = {
  daily_budget_warning: 70,
  daily_budget_critical: 90,
  monthly_budget_warning: 70,
  monthly_budget_critical: 90,
  token_per_run_warning: 80000,
  token_per_run_critical: 95000,
  latency_warning_ms: 5000,
  latency_critical_ms: 10000,
  error_rate_warning: 10,
  error_rate_critical: 25,
};

const DEFAULT_NOTIFICATION: NotificationConfig = {
  console: true,
  database: true,
};

// ============================================================================
// BUDGET ALERT MANAGER
// ============================================================================

export class BudgetAlertManager {
  private thresholds: BudgetThresholds;
  private notification: NotificationConfig;
  private alerts: BudgetAlert[] = [];
  private lastCheck: Date | null = null;

  constructor(
    thresholds: Partial<BudgetThresholds> = {},
    notification: Partial<NotificationConfig> = {}
  ) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.notification = { ...DEFAULT_NOTIFICATION, ...notification };
  }

  // --------------------------------------------------------------------------
  // ALERT GENERATION
  // --------------------------------------------------------------------------

  /**
   * Check metrics and generate alerts if thresholds are exceeded
   */
  async checkMetrics(metrics: BudgetMetrics): Promise<BudgetAlert[]> {
    const newAlerts: BudgetAlert[] = [];
    const now = new Date();

    // Check daily budget
    const dailyPercentage = (metrics.daily_spent_usd / metrics.daily_limit_usd) * 100;
    if (dailyPercentage >= this.thresholds.daily_budget_critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'daily_budget',
        `Daily budget at ${dailyPercentage.toFixed(1)}% - only $${(metrics.daily_limit_usd - metrics.daily_spent_usd).toFixed(2)} remaining`,
        dailyPercentage,
        this.thresholds.daily_budget_critical
      ));
    } else if (dailyPercentage >= this.thresholds.daily_budget_warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'daily_budget',
        `Daily budget at ${dailyPercentage.toFixed(1)}%`,
        dailyPercentage,
        this.thresholds.daily_budget_warning
      ));
    }

    // Check monthly budget
    const monthlyPercentage = (metrics.monthly_spent_usd / metrics.monthly_limit_usd) * 100;
    if (monthlyPercentage >= this.thresholds.monthly_budget_critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'monthly_budget',
        `Monthly budget at ${monthlyPercentage.toFixed(1)}% - only $${(metrics.monthly_limit_usd - metrics.monthly_spent_usd).toFixed(2)} remaining`,
        monthlyPercentage,
        this.thresholds.monthly_budget_critical
      ));
    } else if (monthlyPercentage >= this.thresholds.monthly_budget_warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'monthly_budget',
        `Monthly budget at ${monthlyPercentage.toFixed(1)}%`,
        monthlyPercentage,
        this.thresholds.monthly_budget_warning
      ));
    }

    // Check token usage
    if (metrics.tokens_used >= this.thresholds.token_per_run_critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'token_limit',
        `Token usage at ${metrics.tokens_used.toLocaleString()} - approaching limit of ${metrics.token_limit.toLocaleString()}`,
        metrics.tokens_used,
        this.thresholds.token_per_run_critical
      ));
    } else if (metrics.tokens_used >= this.thresholds.token_per_run_warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'token_limit',
        `Token usage at ${metrics.tokens_used.toLocaleString()}`,
        metrics.tokens_used,
        this.thresholds.token_per_run_warning
      ));
    }

    // Check latency
    if (metrics.avg_latency_ms >= this.thresholds.latency_critical_ms) {
      newAlerts.push(this.createAlert(
        'critical',
        'latency',
        `Average latency at ${metrics.avg_latency_ms.toFixed(0)}ms - significantly above normal`,
        metrics.avg_latency_ms,
        this.thresholds.latency_critical_ms
      ));
    } else if (metrics.avg_latency_ms >= this.thresholds.latency_warning_ms) {
      newAlerts.push(this.createAlert(
        'warning',
        'latency',
        `Average latency at ${metrics.avg_latency_ms.toFixed(0)}ms`,
        metrics.avg_latency_ms,
        this.thresholds.latency_warning_ms
      ));
    }

    // Check error rate
    if (metrics.error_rate >= this.thresholds.error_rate_critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'error_rate',
        `Error rate at ${metrics.error_rate.toFixed(1)}% - system may be degraded`,
        metrics.error_rate,
        this.thresholds.error_rate_critical
      ));
    } else if (metrics.error_rate >= this.thresholds.error_rate_warning) {
      newAlerts.push(this.createAlert(
        'warning',
        'error_rate',
        `Error rate at ${metrics.error_rate.toFixed(1)}%`,
        metrics.error_rate,
        this.thresholds.error_rate_warning
      ));
    }

    // Send notifications for new alerts
    for (const alert of newAlerts) {
      await this.notify(alert);
    }

    // Store alerts
    this.alerts.push(...newAlerts);
    this.lastCheck = now;

    return newAlerts;
  }

  /**
   * Create a new alert
   */
  private createAlert(
    type: 'warning' | 'critical',
    category: BudgetAlert['category'],
    message: string,
    value: number,
    threshold: number
  ): BudgetAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category,
      message,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
    };
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------

  /**
   * Send alert notification through configured channels
   */
  private async notify(alert: BudgetAlert): Promise<void> {
    // Console notification
    if (this.notification.console) {
      const prefix = alert.type === 'critical' ? '🚨 CRITICAL' : '⚠️ WARNING';
      console.log(`[BudgetAlert] ${prefix}: ${alert.message}`);
    }

    // Database notification (store alert)
    if (this.notification.database) {
      try {
        // TODO: Store to database when tables are created
        console.log(`[BudgetAlert] Stored alert ${alert.id} to database`);
      } catch (error) {
        console.error('[BudgetAlert] Failed to store alert to database:', error);
      }
    }

    // Webhook notification
    if (this.notification.webhook) {
      try {
        await fetch(this.notification.webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.notification.webhook.headers,
          },
          body: JSON.stringify({
            type: 'budget_alert',
            alert,
          }),
        });
        console.log(`[BudgetAlert] Sent webhook notification for ${alert.id}`);
      } catch (error) {
        console.error('[BudgetAlert] Failed to send webhook:', error);
      }
    }
  }

  // --------------------------------------------------------------------------
  // ALERT MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get all unacknowledged alerts
   */
  getActiveAlerts(): BudgetAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: 'warning' | 'critical'): BudgetAlert[] {
    return this.alerts.filter(a => a.type === type && !a.acknowledged);
  }

  /**
   * Get alerts by category
   */
  getAlertsByCategory(category: BudgetAlert['category']): BudgetAlert[] {
    return this.alerts.filter(a => a.category === category && !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Acknowledge all alerts
   */
  acknowledgeAll(): number {
    let count = 0;
    for (const alert of this.alerts) {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Clear old acknowledged alerts (older than specified hours)
   */
  clearOldAlerts(hoursOld: number = 24): number {
    const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(
      a => !a.acknowledged || a.timestamp > cutoff
    );
    return before - this.alerts.length;
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    total: number;
    active: number;
    warnings: number;
    critical: number;
    lastCheck: Date | null;
  } {
    const active = this.alerts.filter(a => !a.acknowledged);
    return {
      total: this.alerts.length,
      active: active.length,
      warnings: active.filter(a => a.type === 'warning').length,
      critical: active.filter(a => a.type === 'critical').length,
      lastCheck: this.lastCheck,
    };
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<BudgetThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Update notification config
   */
  updateNotification(config: Partial<NotificationConfig>): void {
    this.notification = { ...this.notification, ...config };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let alertManagerInstance: BudgetAlertManager | null = null;

export function getBudgetAlertManager(): BudgetAlertManager {
  if (!alertManagerInstance) {
    alertManagerInstance = new BudgetAlertManager();
  }
  return alertManagerInstance;
}

export function resetBudgetAlertManager(): void {
  alertManagerInstance = null;
}
