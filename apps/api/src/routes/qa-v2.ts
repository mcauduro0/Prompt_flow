/**
 * QA Framework v2.0 - API Routes
 * Uses the existing weekly-qa-report.ts and qaReportsRepository
 */
import { Router, Request, Response } from 'express';
import { qaReportsRepository } from '@arc/database';

const router: Router = Router();

// Helper function to format report for frontend
function formatReportForFrontend(dbReport: any) {
  const payload = dbReport.payload || {};
  
  return {
    reportId: dbReport.reportId,
    version: payload.version || '2.0',
    generatedAt: payload.generatedAt || dbReport.createdAt,
    weekOf: payload.weekOf || '',
    overallScore: dbReport.overallScore || payload.overallScore || 0,
    status: dbReport.status || payload.status || 'fail',
    sectionScores: {
      lane0: payload.lane0Metrics?.score || 0,
      laneA: payload.laneAMetrics?.score || 0,
      laneB: payload.laneBMetrics?.score || 0,
      laneC: payload.laneCMetrics?.score || 0,
      infrastructure: payload.infrastructureMetrics?.score || 0,
      funnel: payload.funnelMetrics?.score || 0,
    },
    lane0Metrics: payload.lane0Metrics || {},
    laneAMetrics: payload.laneAMetrics || {},
    laneBMetrics: payload.laneBMetrics || {},
    laneCMetrics: payload.laneCMetrics || {},
    infrastructureMetrics: payload.infrastructureMetrics || {},
    funnelMetrics: payload.funnelMetrics || {},
    alerts: (payload.alerts || []).map((a: any, i: number) => ({
      id: `alert-${i}`,
      ...a,
    })),
    alertSummary: {
      total: (payload.alerts || []).length,
      critical: (payload.alerts || []).filter((a: any) => a.severity === 'critical').length,
      warning: (payload.alerts || []).filter((a: any) => a.severity === 'warning').length,
      info: (payload.alerts || []).filter((a: any) => a.severity === 'info').length,
    },
    trends: {
      lane0Trend: { current: payload.lane0Metrics?.score || 0, previous: 0, change: 0, changePercent: 0, trend: payload.trends?.lane0Trend || 'stable' },
      laneATrend: { current: payload.laneAMetrics?.score || 0, previous: 0, change: 0, changePercent: 0, trend: payload.trends?.laneATrend || 'stable' },
      laneBTrend: { current: payload.laneBMetrics?.score || 0, previous: 0, change: 0, changePercent: 0, trend: payload.trends?.laneBTrend || 'stable' },
      laneCTrend: { current: payload.laneCMetrics?.score || 0, previous: 0, change: 0, changePercent: 0, trend: payload.trends?.laneCTrend || 'stable' },
      overallTrend: { current: dbReport.overallScore || 0, previous: 0, change: 0, changePercent: 0, trend: payload.trends?.overallTrend || 'stable' },
      weekOverWeek: [],
    },
    executionTimeMs: 0,
    dataQuality: {
      completeness: 100,
      freshness: 100,
    },
  };
}

// Get Latest Report
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const reports = await qaReportsRepository.getRecent(1);
    if (reports.length === 0) {
      return res.status(404).json({ success: false, error: 'No QA reports found' });
    }
    const formattedReport = formatReportForFrontend(reports[0]);
    res.json({ success: true, report: formattedReport });
  } catch (error) {
    console.error('[QA API v2.0] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get QA report' });
  }
});

// Get Report History
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const reports = await qaReportsRepository.getRecent(limit);
    const formattedReports = reports.map(formatReportForFrontend);
    res.json({ success: true, reports: formattedReports, count: reports.length });
  } catch (error) {
    console.error('[QA API v2.0] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get QA reports' });
  }
});

// Generate New Report - Triggers the worker job via shell command
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { execSync } = await import('child_process');
    
    // Run the QA report generation via the worker CLI
    execSync('cd /opt/arc && node packages/worker/dist/cli.js qa-report', {
      timeout: 120000, // 2 minute timeout
      encoding: 'utf8',
    });
    
    // Fetch the newly generated report
    const reports = await qaReportsRepository.getRecent(1);
    if (reports.length > 0) {
      const formattedReport = formatReportForFrontend(reports[0]);
      res.json({ success: true, report: formattedReport });
    } else {
      res.status(500).json({ success: false, error: 'Report generation completed but no report found' });
    }
  } catch (error) {
    console.error('[QA API v2.0] Error generating report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate QA report: ' + (error as Error).message });
  }
});

// Get Specific Report
router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await qaReportsRepository.getById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    const formattedReport = formatReportForFrontend(report);
    res.json({ success: true, report: formattedReport });
  } catch (error) {
    console.error('[QA API v2.0] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get QA report' });
  }
});

// Generate PDF
router.get('/:reportId/pdf', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await qaReportsRepository.getById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    const formattedReport = formatReportForFrontend(report);
    const html = generatePdfHtml(formattedReport);
    
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const htmlPath = path.join(tempDir, `qa_${reportId}.html`);
    const pdfPath = path.join(tempDir, `qa_${reportId}.pdf`);
    
    fs.writeFileSync(htmlPath, html);
    execSync(`weasyprint "${htmlPath}" "${pdfPath}"`);
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    fs.unlinkSync(htmlPath);
    fs.unlinkSync(pdfPath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="QA_Report_${formattedReport.weekOf || reportId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[QA API v2.0] Error generating PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
});

function generatePdfHtml(report: any): string {
  const statusColor = report.status === 'pass' ? '#22c55e' : report.status === 'warn' ? '#f59e0b' : '#ef4444';
  const alerts = report.alerts || [];
  
  const alertRows = alerts.map((a: any) => {
    const color = a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#3b82f6';
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
        <span style="padding:2px 6px;border-radius:4px;font-size:10px;color:white;background:${color};">${a.severity}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.category}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.message}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>QA Report</title>
<style>
body{font-family:sans-serif;font-size:12px;color:#1f2937;margin:20px;}
.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #e5e7eb;padding-bottom:20px;}
h1{font-size:24px;margin:0 0 10px;}
.score{display:inline-block;padding:10px 30px;border-radius:8px;font-size:32px;font-weight:bold;color:white;background:${statusColor};}
.section{margin-bottom:25px;}
.section h2{font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;}
table{width:100%;border-collapse:collapse;}
th{background:#f9fafb;padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;}
.card .label{font-size:10px;color:#6b7280;text-transform:uppercase;}
.card .value{font-size:18px;font-weight:bold;}
</style></head>
<body>
<div class="header">
  <h1>ARC Investment Factory - QA Report</h1>
  <p>Week of ${report.weekOf || 'N/A'}</p>
  <div class="score">${report.overallScore || 0}/100</div>
  <p style="margin-top:10px;text-transform:uppercase;font-weight:bold;color:${statusColor};">${report.status || 'N/A'}</p>
</div>
<div class="section">
  <h2>Section Scores</h2>
  <div class="grid">
    <div class="card"><div class="label">Lane 0</div><div class="value">${report.sectionScores?.lane0 || 0}</div></div>
    <div class="card"><div class="label">Lane A</div><div class="value">${report.sectionScores?.laneA || 0}</div></div>
    <div class="card"><div class="label">Lane B</div><div class="value">${report.sectionScores?.laneB || 0}</div></div>
    <div class="card"><div class="label">Lane C</div><div class="value">${report.sectionScores?.laneC || 0}</div></div>
    <div class="card"><div class="label">Infrastructure</div><div class="value">${report.sectionScores?.infrastructure || 0}</div></div>
    <div class="card"><div class="label">Funnel</div><div class="value">${report.sectionScores?.funnel || 0}</div></div>
  </div>
</div>
<div class="section">
  <h2>Alerts (${alerts.length})</h2>
  <table>
    <thead><tr><th>Severity</th><th>Category</th><th>Message</th></tr></thead>
    <tbody>${alertRows || '<tr><td colspan="3">No alerts</td></tr>'}</tbody>
  </table>
</div>
<div style="margin-top:30px;text-align:center;color:#9ca3af;font-size:10px;">
  <p>Report ID: ${report.reportId}</p>
  <p>Generated: ${new Date(report.generatedAt).toISOString()}</p>
</div>
</body></html>`;
}

export { router as qaV2Router };
export default router;
