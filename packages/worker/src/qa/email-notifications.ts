/**
 * Email Notifications for QA Alerts
 * Sends email notifications when critical alerts are detected
 */

import type { QAAlert } from './alert-system.js';

// ============================================================================
// Types
// ============================================================================

export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses?: string[];
}

export interface EmailNotification {
  subject: string;
  htmlBody: string;
  textBody: string;
  priority: 'high' | 'normal' | 'low';
  sentAt?: Date;
  error?: string;
}

// ============================================================================
// Email Configuration
// ============================================================================

export function getEmailConfig(): EmailConfig {
  return {
    enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    fromAddress: process.env.EMAIL_FROM || 'arc-qa@example.com',
    toAddresses: (process.env.EMAIL_TO || '').split(',').filter(Boolean),
    ccAddresses: (process.env.EMAIL_CC || '').split(',').filter(Boolean),
  };
}

// ============================================================================
// Email Generation
// ============================================================================

export function generateAlertEmail(
  alerts: QAAlert[],
  reportId: string,
  weekOf: string,
  overallScore: number,
  overallStatus: string
): EmailNotification {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  const subject = criticalAlerts.length > 0
    ? `🚨 [ARC QA] CRITICAL: ${criticalAlerts.length} Critical Alert(s) - Score ${overallScore}`
    : `⚠️ [ARC QA] Warning: ${warningAlerts.length} Warning(s) - Score ${overallScore}`;

  const htmlBody = generateHtmlEmail(alerts, reportId, weekOf, overallScore, overallStatus);
  const textBody = generateTextEmail(alerts, reportId, weekOf, overallScore, overallStatus);

  return {
    subject,
    htmlBody,
    textBody,
    priority: criticalAlerts.length > 0 ? 'high' : 'normal',
  };
}

function generateHtmlEmail(
  alerts: QAAlert[],
  reportId: string,
  weekOf: string,
  overallScore: number,
  overallStatus: string
): string {
  const statusColor = overallStatus === 'healthy' ? '#22c55e' : overallStatus === 'warn' ? '#f59e0b' : '#ef4444';
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  const alertRows = alerts.map(alert => {
    const severityColor = alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: white; background: ${severityColor};">
            ${alert.severity}
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${alert.category}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${alert.message}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">${alert.recommendation || '-'}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0 0 10px 0; font-size: 24px;">ARC Investment Factory</h1>
      <p style="color: #9ca3af; margin: 0; font-size: 14px;">Weekly QA Report Alert</p>
    </div>

    <!-- Score Card -->
    <div style="background: white; padding: 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <div style="display: inline-block; padding: 15px 40px; border-radius: 12px; background: ${statusColor};">
        <span style="font-size: 48px; font-weight: bold; color: white;">${overallScore}</span>
        <span style="font-size: 18px; color: rgba(255,255,255,0.8);">/100</span>
      </div>
      <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px;">
        Week of ${weekOf} • Status: <strong style="text-transform: uppercase; color: ${statusColor};">${overallStatus}</strong>
      </p>
    </div>

    <!-- Alert Summary -->
    <div style="background: white; padding: 25px;">
      <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #111827;">Alert Summary</h2>
      
      <div style="display: flex; gap: 15px; margin-bottom: 25px;">
        <div style="flex: 1; padding: 15px; background: #fef2f2; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #ef4444;">${criticalAlerts.length}</div>
          <div style="font-size: 12px; color: #991b1b; text-transform: uppercase;">Critical</div>
        </div>
        <div style="flex: 1; padding: 15px; background: #fffbeb; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">${warningAlerts.length}</div>
          <div style="font-size: 12px; color: #92400e; text-transform: uppercase;">Warning</div>
        </div>
        <div style="flex: 1; padding: 15px; background: #eff6ff; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">${infoAlerts.length}</div>
          <div style="font-size: 12px; color: #1e40af; text-transform: uppercase;">Info</div>
        </div>
      </div>

      <!-- Alerts Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Severity</th>
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Category</th>
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Message</th>
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows}
        </tbody>
      </table>
    </div>

    <!-- Actions -->
    <div style="background: #f9fafb; padding: 25px; border-radius: 0 0 12px 12px; text-align: center;">
      <a href="${process.env.APP_URL || 'http://localhost:3000'}/qa-v2" 
         style="display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-right: 10px;">
        View Full Report
      </a>
      <a href="${process.env.API_URL || 'http://localhost:3001'}/api/qa-v2/${reportId}/pdf" 
         style="display: inline-block; padding: 12px 30px; background: #6b7280; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Download PDF
      </a>
      <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">
        Report ID: ${reportId}<br>
        Generated: ${new Date().toISOString()}
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateTextEmail(
  alerts: QAAlert[],
  reportId: string,
  weekOf: string,
  overallScore: number,
  overallStatus: string
): string {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  let text = `
ARC INVESTMENT FACTORY - WEEKLY QA REPORT ALERT
================================================

Overall Score: ${overallScore}/100
Status: ${overallStatus.toUpperCase()}
Week of: ${weekOf}

ALERT SUMMARY
-------------
Critical: ${criticalAlerts.length}
Warning: ${warningAlerts.length}
Info: ${infoAlerts.length}

ALERTS
------
`;

  for (const alert of alerts) {
    text += `
[${alert.severity.toUpperCase()}] ${alert.category}
  Message: ${alert.message}
  Recommendation: ${alert.recommendation || 'N/A'}
`;
  }

  text += `
------------------------------------------------
Report ID: ${reportId}
Generated: ${new Date().toISOString()}
View online: ${process.env.APP_URL || 'http://localhost:3000'}/qa-v2
`;

  return text;
}

// ============================================================================
// Email Sending
// ============================================================================

export async function sendAlertEmail(notification: EmailNotification): Promise<{ success: boolean; error?: string }> {
  const config = getEmailConfig();

  if (!config.enabled) {
    console.log('[Email] Notifications disabled, skipping email send');
    return { success: true };
  }

  if (!config.smtpUser || !config.smtpPass) {
    console.log('[Email] SMTP credentials not configured, skipping email send');
    return { success: false, error: 'SMTP credentials not configured' };
  }

  if (config.toAddresses.length === 0) {
    console.log('[Email] No recipients configured, skipping email send');
    return { success: false, error: 'No recipients configured' };
  }

  try {
    // Dynamic import of nodemailer
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    const mailOptions = {
      from: config.fromAddress,
      to: config.toAddresses.join(', '),
      cc: config.ccAddresses?.join(', '),
      subject: notification.subject,
      text: notification.textBody,
      html: notification.htmlBody,
      priority: notification.priority === 'high' ? 'high' : 'normal',
    };

    await transporter.sendMail(mailOptions);

    console.log(`[Email] Alert email sent successfully to ${config.toAddresses.join(', ')}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Failed to send alert email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Notification Trigger
// ============================================================================

export async function notifyOnCriticalAlerts(
  alerts: QAAlert[],
  reportId: string,
  weekOf: string,
  overallScore: number,
  overallStatus: string
): Promise<void> {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  // Only send email if there are critical alerts or multiple warnings
  if (criticalAlerts.length === 0 && warningAlerts.length < 3) {
    console.log('[Email] No critical alerts and less than 3 warnings, skipping notification');
    return;
  }

  const notification = generateAlertEmail(alerts, reportId, weekOf, overallScore, overallStatus);
  const result = await sendAlertEmail(notification);

  if (!result.success) {
    console.error('[Email] Failed to send notification:', result.error);
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  getEmailConfig,
  generateAlertEmail,
  sendAlertEmail,
  notifyOnCriticalAlerts,
};
