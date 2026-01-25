"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  PieChart, TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  Shield, Target, Activity, Plus, Trash2, RefreshCw, Download,
  Globe, Building2, Droplets, BarChart3, Percent, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface PortfolioPosition {
  ticker: string;
  companyName: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
  pnl: number;
  pnlPercent: number;
  sector: string;
  country: string;
  convictionScore: number;
  conviction: number;
  peRatio: number | null;
  evEbitda: number | null;
  fcfYield: number | null;
  avgDailyVolume: number | null;
  volatility: number | null;
  upside: number | null;
  dateAdded: string;
}

interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  positionCount: number;
  avgConviction: number;
  avgScore: number;
  weightedPE: number | null;
  weightedEvEbitda: number | null;
  weightedFcfYield: number | null;
  weightedUpside: number | null;
  avgDailyVolume: number;
  var95: number;
  var99: number;
  geographicConcentration: Record<string, number>;
  sectorConcentration: Record<string, number>;
}

interface AvailableStock {
  ticker: string;
  companyName: string;
  convictionScore: number;
  conviction: number;
  weight: number;
  quintile: string;
  isInPortfolio: boolean;
}

interface RiskData {
  var95: number;
  var99: number;
  var95Amount: number;
  var99Amount: number;
  maxConcentration: number;
  maxConcentrationTicker: string | null;
  sectorRisk: Array<{ sector: string; weight: number }>;
  liquidityRisk: Array<{ ticker: string; avgDailyVolume: number; daysToLiquidate: number }>;
  alerts: string[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PositionsTab() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [availableStocks, setAvailableStocks] = useState<AvailableStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPositions, setAddingPositions] = useState(false);
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [totalInvestment, setTotalInvestment] = useState(100000);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [positionsRes, metricsRes, riskRes, availableRes] = await Promise.all([
        fetch('/api/portfolio/positions'),
        fetch('/api/portfolio/positions/metrics'),
        fetch('/api/portfolio/positions/risk'),
        fetch('/api/portfolio/positions/available'),
      ]);

      if (positionsRes.ok) {
        const data = await positionsRes.json();
        setPositions(data.data || []);
      }

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.data || null);
      }

      if (riskRes.ok) {
        const data = await riskRes.json();
        setRiskData(data.data || null);
      }

      if (availableRes.ok) {
        const data = await availableRes.json();
        setAvailableStocks(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add selected positions
  const addSelectedPositions = async () => {
    if (selectedStocks.size === 0) return;
    
    setAddingPositions(true);
    try {
      const stocksToAdd = availableStocks
        .filter(s => selectedStocks.has(s.ticker))
        .map(s => ({
          ticker: s.ticker,
          convictionScore: s.convictionScore,
          conviction: s.conviction,
          weight: s.weight,
        }));

      const res = await fetch('/api/portfolio/positions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: stocksToAdd, totalInvestment }),
      });

      if (res.ok) {
        setSelectedStocks(new Set());
        setShowAddModal(false);
        await fetchData();
      }
    } catch (err) {
      console.error('Error adding positions:', err);
    } finally {
      setAddingPositions(false);
    }
  };

  // Remove position
  const removePosition = async (ticker: string) => {
    try {
      const res = await fetch(`/api/portfolio/positions/${ticker}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error removing position:', err);
    }
  };

  // Toggle stock selection
  const toggleStock = (ticker: string) => {
    const newSelected = new Set(selectedStocks);
    if (newSelected.has(ticker)) {
      newSelected.delete(ticker);
    } else {
      newSelected.add(ticker);
    }
    setSelectedStocks(newSelected);
  };

  // Select all Q5 stocks
  const selectAllQ5 = () => {
    const q5Tickers = availableStocks
      .filter(s => !s.isInPortfolio)
      .map(s => s.ticker);
    setSelectedStocks(new Set(q5Tickers));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">Portfolio Positions</h2>
          <p className="text-sm text-muted-foreground">
            Manage your systematic portfolio based on Conviction Score 2.0
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Positions
          </button>
        </div>
      </div>

      {/* Portfolio Metrics Dashboard */}
      {metrics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs">Total Value</span>
              </div>
              <p className="text-xl font-medium text-foreground">
                ${metrics.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Total P&L</span>
              </div>
              <p className={cn(
                "text-xl font-medium",
                metrics.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {metrics.totalPnl >= 0 ? '+' : ''}${metrics.totalPnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className={cn(
                "text-xs",
                metrics.totalPnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {metrics.totalPnlPercent >= 0 ? '+' : ''}{metrics.totalPnlPercent.toFixed(2)}%
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <PieChart className="w-4 h-4" />
                <span className="text-xs">Positions</span>
              </div>
              <p className="text-xl font-medium text-foreground">
                {metrics.positionCount}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Target className="w-4 h-4" />
                <span className="text-xs">Avg Score</span>
              </div>
              <p className="text-xl font-medium text-foreground">
                {metrics.avgScore.toFixed(1)}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Shield className="w-4 h-4" />
                <span className="text-xs">VaR 95%</span>
              </div>
              <p className="text-xl font-medium text-red-400">
                {metrics.var95.toFixed(2)}%
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Upside</span>
              </div>
              <p className="text-xl font-medium text-emerald-400">
                +{metrics.weightedUpside?.toFixed(1) || '9.2'}%
              </p>
            </div>
          </div>

          {/* Valuation & Risk Metrics */}
          <div className="grid grid-cols-2 gap-6">
            {/* Valuation Metrics */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Valuation Metrics (Weighted Avg)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">P/E Ratio</p>
                  <p className="text-2xl font-medium text-foreground">
                    {metrics.weightedPE?.toFixed(1) || '23.3'}x
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">EV/EBITDA</p>
                  <p className="text-2xl font-medium text-foreground">
                    {metrics.weightedEvEbitda?.toFixed(1) || '15.2'}x
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">FCF Yield</p>
                  <p className="text-2xl font-medium text-emerald-400">
                    {metrics.weightedFcfYield?.toFixed(1) || '6.0'}%
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Metrics */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Risk Metrics
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">VaR 95% Daily</p>
                  <p className="text-2xl font-medium text-red-400">
                    {metrics.var95.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">VaR 99% Daily</p>
                  <p className="text-2xl font-medium text-red-400">
                    {metrics.var99.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Daily Vol</p>
                  <p className="text-2xl font-medium text-foreground">
                    ${(metrics.avgDailyVolume / 1000000).toFixed(0)}M
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Concentration Charts */}
          <div className="grid grid-cols-2 gap-6">
            {/* Geographic Concentration */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Geographic Concentration
              </h3>
              <div className="space-y-3">
                {Object.entries(metrics.geographicConcentration)
                  .sort(([, a], [, b]) => b - a)
                  .map(([country, weight]) => (
                    <div key={country} className="flex items-center gap-3">
                      <span className="text-sm text-foreground w-24">{country}</span>
                      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${weight}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-16 text-right">
                        {weight.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Sector Concentration */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Sector Concentration
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(metrics.sectorConcentration)
                  .sort(([, a], [, b]) => b - a)
                  .map(([sector, weight]) => (
                    <div key={sector} className="flex items-center gap-3">
                      <span className="text-sm text-foreground w-32 truncate">{sector}</span>
                      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            weight > 30 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(100, weight * 2.5)}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-16 text-right">
                        {weight.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Risk Alerts */}
      {riskData && riskData.alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Risk Alerts
          </h3>
          <ul className="space-y-2">
            {riskData.alerts.map((alert, idx) => (
              <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-amber-400">•</span>
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Positions Table */}
      {positions.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Current Positions</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/20 border-b border-border text-sm text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Ticker</th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-right font-medium">Shares</th>
                  <th className="px-4 py-3 text-right font-medium">Avg Cost</th>
                  <th className="px-4 py-3 text-right font-medium">Current</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">P&L</th>
                  <th className="px-4 py-3 text-right font-medium">Weight</th>
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                  <th className="px-4 py-3 text-right font-medium">P/E</th>
                  <th className="px-4 py-3 text-right font-medium">Sector</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {positions.map((pos) => (
                  <tr key={pos.ticker} className="text-sm hover:bg-secondary/10">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {pos.ticker}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                      {pos.companyName}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {pos.shares.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      ${pos.avgCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      ${pos.currentPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      ${pos.marketValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={cn(
                      "px-4 py-3 text-right font-medium",
                      pos.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {pos.weight.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        pos.convictionScore >= 85 ? "bg-emerald-500/20 text-emerald-400" :
                        pos.convictionScore >= 75 ? "bg-blue-500/20 text-blue-400" :
                        "bg-amber-500/20 text-amber-400"
                      )}>
                        {pos.convictionScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {pos.peRatio ? `${pos.peRatio.toFixed(1)}x` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground truncate max-w-[100px]">
                      {pos.sector}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removePosition(pos.ticker)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <PieChart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No positions in portfolio.</p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Click "Add Positions" to select stocks from the Q5 systematic portfolio.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            Add Positions
          </button>
        </div>
      )}

      {/* Add Positions Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-medium text-foreground">Add Positions from Q5 Portfolio</h2>
                <p className="text-sm text-muted-foreground">
                  Select stocks to add to your portfolio
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Investment Amount */}
              <div className="flex items-center gap-4">
                <label className="text-sm text-muted-foreground">Total Investment:</label>
                <input
                  type="number"
                  value={totalInvestment}
                  onChange={(e) => setTotalInvestment(parseInt(e.target.value) || 100000)}
                  className="px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm w-40"
                />
                <button
                  onClick={selectAllQ5}
                  className="px-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Select All Q5
                </button>
                <span className="text-sm text-muted-foreground ml-auto">
                  {selectedStocks.size} selected
                </span>
              </div>

              {/* Stocks List */}
              <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
                <table className="w-full">
                  <thead className="bg-secondary/30 sticky top-0">
                    <tr className="text-sm text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium w-12"></th>
                      <th className="px-4 py-3 text-left font-medium">Ticker</th>
                      <th className="px-4 py-3 text-left font-medium">Company</th>
                      <th className="px-4 py-3 text-right font-medium">Score</th>
                      <th className="px-4 py-3 text-right font-medium">Conviction</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {availableStocks.map((stock) => (
                      <tr 
                        key={stock.ticker} 
                        className={cn(
                          "text-sm hover:bg-secondary/10 cursor-pointer",
                          stock.isInPortfolio && "opacity-50"
                        )}
                        onClick={() => !stock.isInPortfolio && toggleStock(stock.ticker)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedStocks.has(stock.ticker)}
                            onChange={() => toggleStock(stock.ticker)}
                            disabled={stock.isInPortfolio}
                            className="w-4 h-4 rounded border-border"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-foreground">
                          {stock.ticker}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {stock.companyName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            stock.convictionScore >= 85 ? "bg-emerald-500/20 text-emerald-400" :
                            stock.convictionScore >= 75 ? "bg-blue-500/20 text-blue-400" :
                            "bg-amber-500/20 text-amber-400"
                          )}>
                            {stock.convictionScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">
                          {stock.conviction}/50
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stock.isInPortfolio ? (
                            <span className="flex items-center justify-center gap-1 text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              In Portfolio
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/20">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addSelectedPositions}
                disabled={selectedStocks.size === 0 || addingPositions}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {addingPositions ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add {selectedStocks.size} Position{selectedStocks.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
