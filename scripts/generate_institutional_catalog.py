#!/usr/bin/env python3
"""
Generate ARC Investment Factory - Prompt Catalog (Institutional Version)

This script generates a complete institutional catalog with all required fields:
- expected_value_score (0.0-1.0)
- expected_cost_score (0.0-1.0)
- value_cost_ratio (calculated)
- min_signal_dependency (0.0-1.0 or gate)
- dependency_type (always, lane_a_promotion, gate_pass, signal_threshold, manual_only)
- status_institucional (core, supporting, optional, experimental, deprecated)
"""

import json
from typing import Dict, List, Any

# Define institutional metadata for all 116 prompts
# Organized by category for clarity

PROMPT_METADATA = {
    # ============================================================================
    # LANE B - THESIS DEVELOPMENT (Synthesis Stage)
    # Core prompts for investment decision synthesis
    # ============================================================================
    "bull_bear_analysis": {
        "expected_value_score": 0.95,
        "expected_cost_score": 0.60,
        "min_signal_dependency": 0.70,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["financial_statement_analysis", "valuation_analysis", "risk_assessment"],
        "category": "Thesis Development",
        "description": "Develops balanced bull and bear cases for investment thesis with probability-weighted scenarios"
    },
    "investment_thesis_synthesis": {
        "expected_value_score": 1.00,
        "expected_cost_score": 0.70,
        "min_signal_dependency": 0.75,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["business_overview_report", "financial_statement_analysis", "valuation_analysis", "risk_assessment", "bull_bear_analysis"],
        "category": "Thesis Development",
        "description": "Synthesizes all research modules into a coherent investment thesis with actionable recommendation"
    },
    "variant_perception": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.55,
        "min_signal_dependency": 0.60,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Thesis Development",
        "description": "Identifies where our view differs from consensus and why we might be right"
    },
    "contrarian_thesis_development": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.50,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["bull_bear_analysis"],
        "category": "Thesis Development",
        "description": "Develops contrarian investment thesis when consensus view may be wrong"
    },
    "peer_thesis_comparison": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.50,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Thesis Development",
        "description": "Compares our thesis against sell-side and buy-side consensus views"
    },
    "thesis_monitoring_framework": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.60,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Thesis Development",
        "description": "Creates framework for ongoing thesis validation and key metrics to monitor"
    },
    "sector_thesis_stress_test": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.55,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Thesis Development",
        "description": "Stress tests sector-level thesis assumptions under various scenarios"
    },

    # ============================================================================
    # LANE B - OUTPUT GENERATION
    # Final deliverables and presentation materials
    # ============================================================================
    "investment_memo": {
        "expected_value_score": 0.90,
        "expected_cost_score": 0.65,
        "min_signal_dependency": 0.80,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Output Generation",
        "description": "Generates formal investment memo for investment committee review"
    },
    "investment_presentation_creator": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.60,
        "min_signal_dependency": 0.75,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_memo"],
        "category": "Output Generation",
        "description": "Creates presentation slides summarizing investment thesis"
    },
    "thesis_presentation": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.55,
        "min_signal_dependency": 0.70,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Output Generation",
        "description": "Generates structured thesis presentation for stakeholder communication"
    },
    "research_report_summary": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.60,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Output Generation",
        "description": "Summarizes full research report into executive summary format"
    },

    # ============================================================================
    # LANE B - BUSINESS ANALYSIS
    # Core business understanding modules
    # ============================================================================
    "business_overview_report": {
        "expected_value_score": 0.90,
        "expected_cost_score": 0.55,
        "min_signal_dependency": 0.00,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Business Analysis",
        "description": "Comprehensive overview of business model, products, and market position"
    },
    "business_economics": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.30,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["business_overview_report"],
        "category": "Business Analysis",
        "description": "Analyzes unit economics, pricing power, and business model sustainability"
    },
    "customer_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.30,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["business_overview_report"],
        "category": "Business Analysis",
        "description": "Analyzes customer segments, concentration, and retention dynamics"
    },
    "segment_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.30,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["business_overview_report"],
        "category": "Business Analysis",
        "description": "Detailed analysis of business segments and their contribution to value"
    },
    "geographic_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["business_overview_report"],
        "category": "Business Analysis",
        "description": "Analyzes geographic revenue distribution and regional growth opportunities"
    },
    "supply_chain_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.30,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["business_overview_report"],
        "category": "Business Analysis",
        "description": "Analyzes supply chain dependencies, risks, and competitive advantages"
    },
    "technology_ip_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.30,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["business_overview_report"],
        "category": "Business Analysis",
        "description": "Analyzes technology assets, IP portfolio, and innovation pipeline"
    },

    # ============================================================================
    # LANE B - FINANCIAL ANALYSIS
    # Core financial due diligence modules
    # ============================================================================
    "financial_statement_analysis": {
        "expected_value_score": 0.95,
        "expected_cost_score": 0.55,
        "min_signal_dependency": 0.00,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Financial Analysis",
        "description": "Comprehensive analysis of income statement, balance sheet, and cash flow"
    },
    "valuation_analysis": {
        "expected_value_score": 1.00,
        "expected_cost_score": 0.60,
        "min_signal_dependency": 0.40,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Multi-method valuation analysis with DCF, comparables, and scenario analysis"
    },
    "earnings_quality_analysis": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.35,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Assesses quality and sustainability of reported earnings"
    },
    "capital_allocation_analysis": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.35,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Analyzes capital allocation decisions and return on invested capital"
    },
    "debt_structure_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.30,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Analyzes debt maturity profile, covenants, and refinancing risk"
    },
    "working_capital_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Analyzes working capital efficiency and cash conversion cycle"
    },
    "capital_structure_optimizer": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["debt_structure_analysis"],
        "category": "Financial Analysis",
        "description": "Models optimal capital structure scenarios"
    },
    "growth_margin_drivers": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.35,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Identifies key drivers of revenue growth and margin expansion"
    },
    "ma_history_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["business_overview_report"],
        "category": "Financial Analysis",
        "description": "Analyzes M&A track record and integration success"
    },
    "income_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.30,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Detailed income statement analysis and revenue quality assessment"
    },
    "rebalancing_analysis": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["financial_statement_analysis"],
        "category": "Financial Analysis",
        "description": "Analyzes portfolio rebalancing implications and timing"
    },

    # ============================================================================
    # LANE B - INDUSTRY ANALYSIS
    # Competitive and industry context modules
    # ============================================================================
    "competitive_analysis": {
        "expected_value_score": 0.90,
        "expected_cost_score": 0.55,
        "min_signal_dependency": 0.30,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["business_overview_report"],
        "category": "Industry Analysis",
        "description": "Comprehensive competitive positioning and market share analysis"
    },
    "industry_overview": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.25,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Industry Analysis",
        "description": "Industry structure, dynamics, and growth outlook analysis"
    },
    "tam_sam_som_analyzer": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.30,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["industry_overview"],
        "category": "Industry Analysis",
        "description": "Total addressable market sizing and serviceable market analysis"
    },
    "competitive_landscape_mapping": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["competitive_analysis"],
        "category": "Industry Analysis",
        "description": "Maps competitive landscape and strategic group positioning"
    },
    "sector_rotation_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["industry_overview"],
        "category": "Industry Analysis",
        "description": "Analyzes sector rotation patterns and cyclical positioning"
    },
    "sector_sensitivity_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["industry_overview"],
        "category": "Industry Analysis",
        "description": "Analyzes sector sensitivity to macro factors"
    },

    # ============================================================================
    # LANE B - MANAGEMENT ANALYSIS
    # Management quality and governance modules
    # ============================================================================
    "management_quality_assessment": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.35,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["business_overview_report"],
        "category": "Management Analysis",
        "description": "Comprehensive assessment of management quality and track record"
    },
    "ceo_track_record": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.30,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["management_quality_assessment"],
        "category": "Management Analysis",
        "description": "Detailed analysis of CEO's historical performance and decisions"
    },
    "esg_analysis": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["business_overview_report"],
        "category": "Management Analysis",
        "description": "Environmental, social, and governance risk assessment"
    },
    "esg_portfolio_analysis": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["esg_analysis"],
        "category": "Management Analysis",
        "description": "Portfolio-level ESG exposure and risk analysis"
    },

    # ============================================================================
    # LANE B - RISK ANALYSIS
    # Risk identification and assessment modules
    # ============================================================================
    "risk_assessment": {
        "expected_value_score": 0.95,
        "expected_cost_score": 0.55,
        "min_signal_dependency": 0.40,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["financial_statement_analysis", "competitive_analysis"],
        "category": "Risk Analysis",
        "description": "Comprehensive risk assessment across all dimensions"
    },
    "risk_factor_identifier": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.35,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["risk_assessment"],
        "category": "Risk Analysis",
        "description": "Identifies and categorizes key risk factors"
    },
    "regulatory_risk_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.30,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["business_overview_report"],
        "category": "Risk Analysis",
        "description": "Analyzes regulatory environment and compliance risks"
    },
    "geopolitical_risk_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["geographic_analysis"],
        "category": "Risk Analysis",
        "description": "Analyzes geopolitical risks affecting the investment"
    },
    "pre_mortem_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.50,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Risk Analysis",
        "description": "Pre-mortem analysis of what could cause the thesis to fail"
    },

    # ============================================================================
    # LANE B - CATALYST ANALYSIS
    # Catalyst identification and timing modules
    # ============================================================================
    "catalyst_identification": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.40,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["business_overview_report", "financial_statement_analysis"],
        "category": "Catalyst Analysis",
        "description": "Identifies potential catalysts and their timing"
    },
    "short_interest_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Catalyst Analysis",
        "description": "Analyzes short interest and potential squeeze dynamics"
    },
    "insider_activity_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Catalyst Analysis",
        "description": "Analyzes insider buying/selling patterns and implications"
    },

    # ============================================================================
    # LANE B - SPECIAL SITUATIONS
    # Special situation analysis modules
    # ============================================================================
    "activist_situation_analyzer": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.40,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["business_overview_report"],
        "category": "Special Situations",
        "description": "Analyzes activist investor involvement and potential outcomes"
    },
    "spinoff_opportunity_analyzer": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.40,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["segment_analysis"],
        "category": "Special Situations",
        "description": "Analyzes spinoff opportunities and value creation potential"
    },
    "ipo_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.35,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Special Situations",
        "description": "Analyzes IPO opportunities and valuation"
    },
    "exit_strategy": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.50,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Special Situations",
        "description": "Develops exit strategy and price targets"
    },

    # ============================================================================
    # LANE B - MACRO ANALYSIS (Research Stage)
    # Macro context for individual securities
    # ============================================================================
    "currency_analysis": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["geographic_analysis"],
        "category": "Macro Analysis",
        "description": "Analyzes currency exposure and FX risk"
    },
    "currency_hedging_analysis": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["currency_analysis"],
        "category": "Macro Analysis",
        "description": "Analyzes currency hedging strategies and costs"
    },
    "commodity_analysis": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["business_overview_report"],
        "category": "Macro Analysis",
        "description": "Analyzes commodity exposure and price sensitivity"
    },
    "credit_cycle_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["debt_structure_analysis"],
        "category": "Macro Analysis",
        "description": "Analyzes credit cycle positioning and implications"
    },
    "election_impact_analysis": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "experimental",
        "dependencies": ["regulatory_risk_analysis"],
        "category": "Macro Analysis",
        "description": "Analyzes potential election impact on the investment"
    },
    "liquidity_conditions_analysis": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Macro Analysis",
        "description": "Analyzes market liquidity conditions and trading implications"
    },
    "market_regime_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Macro Analysis",
        "description": "Identifies current market regime and implications"
    },
    "yield_curve_analysis": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Macro Analysis",
        "description": "Analyzes yield curve dynamics and sector implications"
    },

    # ============================================================================
    # LANE A - MACRO CONTEXT
    # Market-wide macro analysis for idea generation
    # ============================================================================
    "macro_environment_analysis": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "core",
        "dependencies": [],
        "category": "Macro Context",
        "description": "Comprehensive macro environment scan for investment context"
    },
    "fed_policy_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": ["macro_environment_analysis"],
        "category": "Macro Context",
        "description": "Analyzes Fed policy trajectory and market implications"
    },
    "inflation_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": ["macro_environment_analysis"],
        "category": "Macro Context",
        "description": "Analyzes inflation dynamics and investment implications"
    },
    "china_macro_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "optional",
        "dependencies": ["macro_environment_analysis"],
        "category": "Macro Context",
        "description": "Analyzes China macro conditions and global implications"
    },
    "economic_indicator_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": ["macro_environment_analysis"],
        "category": "Macro Context",
        "description": "Analyzes key economic indicators and trends"
    },
    "global_macro_scan": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Macro Context",
        "description": "Global macro scan for cross-border investment themes"
    },
    "earnings_season_preview": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Macro Context",
        "description": "Preview of upcoming earnings season themes and expectations"
    },
    "earnings_season_analyzer": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": ["earnings_season_preview"],
        "category": "Macro Context",
        "description": "Analyzes earnings season results and trends"
    },

    # ============================================================================
    # LANE A - SIGNAL COLLECTION
    # External signal gathering for idea generation
    # ============================================================================
    "social_sentiment_scanner": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Scans social trends for sentiment signals using SocialTrendsClient"
    },
    "insider_trading_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Analyzes insider trading patterns for investment signals"
    },
    "institutional_clustering_13f": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Analyzes 13F filings for institutional clustering patterns"
    },
    "newsletter_idea_scraping": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "optional",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Scrapes investment newsletters for idea generation"
    },
    "niche_publication_scanner": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "optional",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Scans niche publications for undiscovered ideas"
    },
    "substack_idea_scraping": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "optional",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Scrapes Substack for investment ideas and analysis"
    },
    "deep_web_trend_scanner": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "experimental",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Scans deep web sources for emerging trends"
    },
    "reddit_memestock_scraper": {
        "expected_value_score": 0.45,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "experimental",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Monitors Reddit for retail sentiment and meme stock activity"
    },
    "socialtrends_copytrading_scraper": {
        "expected_value_score": 0.50,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "experimental",
        "dependencies": [],
        "category": "Signal Collection",
        "description": "Analyzes social trends for copy-trading signals via SocialTrendsClient"
    },

    # ============================================================================
    # LANE A - SCREENING
    # Idea screening and filtering modules
    # ============================================================================
    "thematic_idea_generator": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "core",
        "dependencies": ["macro_environment_analysis"],
        "category": "Screening",
        "description": "Generates investment ideas based on thematic trends"
    },
    "pure_play_filter": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.30,
        "dependency_type": "gate_pass",
        "status_institucional": "core",
        "dependencies": ["thematic_idea_generator"],
        "category": "Screening",
        "description": "Filters for pure-play exposure to investment themes"
    },
    "thematic_candidate_screen": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.25,
        "dependency_type": "gate_pass",
        "status_institucional": "supporting",
        "dependencies": ["thematic_idea_generator"],
        "category": "Screening",
        "description": "Screens candidates against thematic criteria"
    },
    "watchlist_screening": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.20,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Screening",
        "description": "Screens watchlist for actionable opportunities"
    },
    "under_radar_discovery": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Screening",
        "description": "Discovers under-followed stocks with potential"
    },
    "identify_pure_plays": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "gate_pass",
        "status_institucional": "supporting",
        "dependencies": ["thematic_idea_generator"],
        "category": "Screening",
        "description": "Identifies pure-play investment opportunities"
    },
    "theme_subsector_expansion": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["thematic_idea_generator"],
        "category": "Screening",
        "description": "Expands themes into subsector opportunities"
    },
    "theme_order_effects": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["thematic_idea_generator"],
        "category": "Screening",
        "description": "Analyzes second-order effects of investment themes"
    },
    "connecting_disparate_trends": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.20,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["macro_environment_analysis"],
        "category": "Screening",
        "description": "Connects disparate trends to identify unique opportunities"
    },

    # ============================================================================
    # LANE A - DISCOVERY
    # Idea discovery and mapping modules
    # ============================================================================
    "trend_to_equity_mapper": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.30,
        "dependency_type": "gate_pass",
        "status_institucional": "core",
        "dependencies": ["thematic_idea_generator"],
        "category": "Discovery",
        "description": "Maps macro trends to specific equity opportunities"
    },
    "value_chain_mapper": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["trend_to_equity_mapper"],
        "category": "Discovery",
        "description": "Maps value chain to identify investment opportunities"
    },
    "historical_parallel_finder": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "supporting",
        "dependencies": ["thematic_idea_generator"],
        "category": "Discovery",
        "description": "Finds historical parallels for current investment themes"
    },
    "historical_parallel_stress_test": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.30,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["historical_parallel_finder"],
        "category": "Discovery",
        "description": "Stress tests thesis against historical parallels"
    },
    "bull_bear_case_generator": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.35,
        "dependency_type": "gate_pass",
        "status_institucional": "supporting",
        "dependencies": ["trend_to_equity_mapper"],
        "category": "Discovery",
        "description": "Generates preliminary bull/bear cases for discovered ideas"
    },
    "sector_momentum_ranker": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Discovery",
        "description": "Ranks sectors by momentum for idea prioritization"
    },
    "competitor_earnings_comparison": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["earnings_season_analyzer"],
        "category": "Discovery",
        "description": "Compares earnings across competitors for relative value"
    },
    "earnings_preview_generator": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.25,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["earnings_season_preview"],
        "category": "Discovery",
        "description": "Generates earnings preview for specific companies"
    },

    # ============================================================================
    # LANE A - GATES
    # Deterministic validation gates
    # ============================================================================
    "gate_data_sufficiency": {
        "expected_value_score": 0.90,
        "expected_cost_score": 0.10,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "core",
        "dependencies": [],
        "category": "Gates",
        "description": "Validates data sufficiency before proceeding with analysis"
    },
    "gate_coherence": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.10,
        "min_signal_dependency": 0.50,
        "dependency_type": "gate_pass",
        "status_institucional": "core",
        "dependencies": ["lane_a_idea_generation"],
        "category": "Gates",
        "description": "Validates coherence of generated investment idea"
    },
    "gate_style_fit": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.10,
        "min_signal_dependency": 0.60,
        "dependency_type": "gate_pass",
        "status_institucional": "core",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Gates",
        "description": "Validates fit with investment style and mandate"
    },
    "lane_a_idea_generation": {
        "expected_value_score": 0.95,
        "expected_cost_score": 0.50,
        "min_signal_dependency": 0.00,
        "dependency_type": "gate_pass",
        "status_institucional": "core",
        "dependencies": ["gate_data_sufficiency"],
        "category": "Gates",
        "description": "Core idea generation prompt for Lane A discovery"
    },

    # ============================================================================
    # PORTFOLIO - RISK MANAGEMENT
    # Portfolio-level risk management modules
    # ============================================================================
    "benchmark_comparison": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Portfolio Risk",
        "description": "Compares portfolio performance against benchmarks"
    },
    "correlation_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Portfolio Risk",
        "description": "Analyzes correlation structure of portfolio holdings"
    },
    "drawdown_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Portfolio Risk",
        "description": "Analyzes historical drawdowns and recovery patterns"
    },
    "factor_exposure_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Portfolio Risk",
        "description": "Analyzes portfolio factor exposures"
    },
    "factor_exposure_analyzer": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": ["factor_exposure_analysis"],
        "category": "Portfolio Risk",
        "description": "Detailed factor exposure analysis and attribution"
    },
    "liquidity_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Portfolio Risk",
        "description": "Analyzes portfolio liquidity and trading capacity"
    },
    "risk_monitoring": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "core",
        "dependencies": [],
        "category": "Portfolio Risk",
        "description": "Ongoing risk monitoring and alerting"
    },
    "scenario_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Portfolio Risk",
        "description": "Scenario analysis for portfolio stress testing"
    },

    # ============================================================================
    # PORTFOLIO - CONSTRUCTION
    # Portfolio construction and optimization modules
    # ============================================================================
    "portfolio_construction": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "core",
        "dependencies": [],
        "category": "Portfolio Construction",
        "description": "Portfolio construction and optimization"
    },
    "position_sizer": {
        "expected_value_score": 0.80,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.50,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "core",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Portfolio Construction",
        "description": "Determines optimal position size based on conviction and risk"
    },
    "position_sizing": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.50,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["position_sizer"],
        "category": "Portfolio Construction",
        "description": "Position sizing calculations and constraints"
    },
    "portfolio_performance_reporter": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Portfolio Construction",
        "description": "Generates portfolio performance reports"
    },

    # ============================================================================
    # MONITORING
    # Ongoing position and thesis monitoring
    # ============================================================================
    "thesis_update": {
        "expected_value_score": 0.85,
        "expected_cost_score": 0.45,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "core",
        "dependencies": [],
        "category": "Monitoring",
        "description": "Updates investment thesis based on new information"
    },
    "news_sentiment_monitor": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Monitoring",
        "description": "Monitors news sentiment for portfolio positions"
    },
    "earnings_call_analysis": {
        "expected_value_score": 0.75,
        "expected_cost_score": 0.40,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Monitoring",
        "description": "Analyzes earnings calls for thesis validation"
    },

    # ============================================================================
    # UTILITY
    # Utility and helper prompts
    # ============================================================================
    "daily_market_briefing": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Utility",
        "description": "Generates daily market briefing"
    },
    "news_sentiment_analysis": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Utility",
        "description": "Analyzes news sentiment for specific securities"
    },
    "sec_filing_analysis": {
        "expected_value_score": 0.70,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Utility",
        "description": "Analyzes SEC filings for material information"
    },
    "investment_policy_compliance": {
        "expected_value_score": 0.60,
        "expected_cost_score": 0.20,
        "min_signal_dependency": 0.50,
        "dependency_type": "lane_a_promotion",
        "status_institucional": "supporting",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Utility",
        "description": "Validates investment against policy constraints"
    },
    "options_overlay_strategy": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.35,
        "min_signal_dependency": 0.40,
        "dependency_type": "signal_threshold",
        "status_institucional": "optional",
        "dependencies": ["investment_thesis_synthesis"],
        "category": "Utility",
        "description": "Develops options overlay strategies"
    },
    "performance_attribution": {
        "expected_value_score": 0.65,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "supporting",
        "dependencies": [],
        "category": "Utility",
        "description": "Performance attribution analysis"
    },
    "tax_loss_harvesting": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.25,
        "min_signal_dependency": 0.00,
        "dependency_type": "always",
        "status_institucional": "optional",
        "dependencies": [],
        "category": "Utility",
        "description": "Identifies tax loss harvesting opportunities"
    },
    "transition_management": {
        "expected_value_score": 0.55,
        "expected_cost_score": 0.30,
        "min_signal_dependency": 0.00,
        "dependency_type": "manual_only",
        "status_institucional": "optional",
        "dependencies": [],
        "category": "Utility",
        "description": "Manages portfolio transitions and rebalancing"
    },
}

# Handle the twitter_copytrading_scraper rename
PROMPT_METADATA["twitter_copytrading_scraper"] = PROMPT_METADATA["socialtrends_copytrading_scraper"].copy()
PROMPT_METADATA["twitter_copytrading_scraper"]["description"] = "DEPRECATED: Use socialtrends_copytrading_scraper. Analyzes social trends for copy-trading signals via SocialTrendsClient"
PROMPT_METADATA["twitter_copytrading_scraper"]["status_institucional"] = "deprecated"


def calculate_value_cost_ratio(value: float, cost: float) -> float:
    """Calculate value/cost ratio, handling division by zero"""
    if cost == 0:
        return 10.0  # Max ratio for zero-cost prompts
    return round(value / cost, 2)


def generate_catalog() -> str:
    """Generate the complete institutional catalog document"""
    
    # Sort prompts by category for organized output
    categories = {}
    for prompt_id, meta in PROMPT_METADATA.items():
        cat = meta.get("category", "Other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append((prompt_id, meta))
    
    # Sort within categories by expected_value_score descending
    for cat in categories:
        categories[cat].sort(key=lambda x: -x[1]["expected_value_score"])
    
    # Generate document
    doc = []
    
    # Header
    doc.append("# ARC Investment Factory – Prompt Catalog (Institutional Version)")
    doc.append("")
    doc.append("**Version:** 2.0.0")
    doc.append("**Last Updated:** 2026-01-12")
    doc.append("**Total Prompts:** 116")
    doc.append("")
    doc.append("---")
    doc.append("")
    
    # Governance Section
    doc.append("## Governança do Prompt Catalog")
    doc.append("")
    doc.append("Esta seção explica como o sistema utiliza os campos institucionais para decisões de execução em produção.")
    doc.append("")
    doc.append("### Como expected_value_score e expected_cost_score são usados pelo orquestrador")
    doc.append("")
    doc.append("O **PromptSelector** utiliza esses scores para otimizar a seleção de prompts dentro das restrições de budget:")
    doc.append("")
    doc.append("1. **expected_value_score** (0.0-1.0): Representa o valor esperado do output para a decisão de investimento. Prompts com score mais alto são priorizados quando há restrições de budget ou tempo.")
    doc.append("")
    doc.append("2. **expected_cost_score** (0.0-1.0): Representa o custo relativo em tokens, latência e uso de fontes externas. O orquestrador usa esse score para estimar consumo de budget antes da execução.")
    doc.append("")
    doc.append("3. **value_cost_ratio**: Calculado automaticamente como `expected_value_score / expected_cost_score`. Prompts com ratio mais alto oferecem melhor retorno por unidade de custo e são preferidos em cenários de budget limitado.")
    doc.append("")
    doc.append("### Como min_signal_dependency influencia execução")
    doc.append("")
    doc.append("O campo **min_signal_dependency** define o nível mínimo de sinal ou convicção necessário para o prompt ser elegível:")
    doc.append("")
    doc.append("- **0.0**: Prompt pode executar sem sinais prévios (ex: gates iniciais, macro scans)")
    doc.append("- **0.25-0.50**: Requer sinais básicos de prompts upstream")
    doc.append("- **0.50-0.75**: Requer sinais moderados e validação de gates")
    doc.append("- **0.75-1.0**: Requer alta convicção e múltiplos sinais confirmados")
    doc.append("")
    doc.append("### Como status_institucional afeta elegibilidade automática")
    doc.append("")
    doc.append("| Status | Comportamento |")
    doc.append("|--------|---------------|")
    doc.append("| **core** | Sempre executado quando elegível. Essencial para decisão de investimento. |")
    doc.append("| **supporting** | Executado conforme budget disponível e sinais. Enriquece análise. |")
    doc.append("| **optional** | Executado apenas se budget permitir e houver valor marginal. |")
    doc.append("| **experimental** | Em teste. Não crítico para decisão. Pode ser desabilitado. |")
    doc.append("| **deprecated** | Mantido por compatibilidade. Não executado automaticamente. |")
    doc.append("")
    doc.append("### Como métricas de qualidade retroalimentam ajustes futuros")
    doc.append("")
    doc.append("O **TelemetryStore** registra métricas de qualidade para cada execução:")
    doc.append("")
    doc.append("1. **lane_outcome**: Resultado final do lane (success, partial, failure)")
    doc.append("2. **quality_score**: Score de qualidade do output (0.0-1.0)")
    doc.append("3. **actual_cost**: Custo real em tokens e latência")
    doc.append("")
    doc.append("Essas métricas são usadas para:")
    doc.append("- Ajustar expected_value_score baseado em performance histórica")
    doc.append("- Calibrar expected_cost_score com custos reais observados")
    doc.append("- Identificar prompts para promoção (optional → supporting) ou deprecação")
    doc.append("")
    doc.append("---")
    doc.append("")
    
    # Quick Reference Table
    doc.append("## Quick Reference Table")
    doc.append("")
    doc.append("| # | Prompt ID | Lane | Category | Value | Cost | Ratio | Dep Type | Status |")
    doc.append("|---|-----------|------|----------|-------|------|-------|----------|--------|")
    
    idx = 1
    for cat in sorted(categories.keys()):
        for prompt_id, meta in categories[cat]:
            ratio = calculate_value_cost_ratio(meta["expected_value_score"], meta["expected_cost_score"])
            lane = "lane_a" if "lane_a" in meta.get("dependencies", []) or meta["dependency_type"] == "always" else "lane_b"
            if "portfolio" in meta["category"].lower():
                lane = "portfolio"
            elif "monitoring" in meta["category"].lower():
                lane = "monitoring"
            elif "utility" in meta["category"].lower():
                lane = "utility"
            elif "gate" in meta["category"].lower() or "discovery" in meta["category"].lower() or "screening" in meta["category"].lower() or "signal" in meta["category"].lower() or "macro context" in meta["category"].lower():
                lane = "lane_a"
            else:
                lane = "lane_b"
            
            doc.append(f"| {idx} | `{prompt_id}` | {lane} | {meta['category']} | {meta['expected_value_score']:.2f} | {meta['expected_cost_score']:.2f} | {ratio:.2f} | {meta['dependency_type']} | {meta['status_institucional']} |")
            idx += 1
    
    doc.append("")
    doc.append("---")
    doc.append("")
    
    # Detailed Catalog by Category
    doc.append("## Detailed Prompt Catalog")
    doc.append("")
    
    for cat in sorted(categories.keys()):
        doc.append(f"### {cat}")
        doc.append("")
        
        for prompt_id, meta in categories[cat]:
            ratio = calculate_value_cost_ratio(meta["expected_value_score"], meta["expected_cost_score"])
            
            doc.append(f"#### `{prompt_id}`")
            doc.append("")
            doc.append(f"**Description:** {meta['description']}")
            doc.append("")
            doc.append("| Field | Value |")
            doc.append("|-------|-------|")
            doc.append(f"| expected_value_score | {meta['expected_value_score']:.2f} |")
            doc.append(f"| expected_cost_score | {meta['expected_cost_score']:.2f} |")
            doc.append(f"| value_cost_ratio | {ratio:.2f} |")
            doc.append(f"| min_signal_dependency | {meta['min_signal_dependency']:.2f} |")
            doc.append(f"| dependency_type | {meta['dependency_type']} |")
            doc.append(f"| status_institucional | {meta['status_institucional']} |")
            doc.append("")
            
            if meta["dependencies"]:
                doc.append("**Dependencies:**")
                for dep in meta["dependencies"]:
                    doc.append(f"- `{dep}`")
                doc.append("")
            else:
                doc.append("**Dependencies:** None (entry point)")
                doc.append("")
            
            doc.append("---")
            doc.append("")
    
    # Summary Statistics
    doc.append("## Summary Statistics")
    doc.append("")
    
    # Count by status
    status_counts = {}
    for meta in PROMPT_METADATA.values():
        status = meta["status_institucional"]
        status_counts[status] = status_counts.get(status, 0) + 1
    
    doc.append("### By Status")
    doc.append("")
    doc.append("| Status | Count | Percentage |")
    doc.append("|--------|-------|------------|")
    total = len(PROMPT_METADATA)
    for status in ["core", "supporting", "optional", "experimental", "deprecated"]:
        count = status_counts.get(status, 0)
        pct = (count / total) * 100
        doc.append(f"| {status} | {count} | {pct:.1f}% |")
    
    doc.append("")
    
    # Count by dependency type
    dep_counts = {}
    for meta in PROMPT_METADATA.values():
        dep = meta["dependency_type"]
        dep_counts[dep] = dep_counts.get(dep, 0) + 1
    
    doc.append("### By Dependency Type")
    doc.append("")
    doc.append("| Type | Count | Percentage |")
    doc.append("|------|-------|------------|")
    for dep_type in ["always", "lane_a_promotion", "gate_pass", "signal_threshold", "manual_only"]:
        count = dep_counts.get(dep_type, 0)
        pct = (count / total) * 100
        doc.append(f"| {dep_type} | {count} | {pct:.1f}% |")
    
    doc.append("")
    
    # Average scores
    avg_value = sum(m["expected_value_score"] for m in PROMPT_METADATA.values()) / total
    avg_cost = sum(m["expected_cost_score"] for m in PROMPT_METADATA.values()) / total
    avg_ratio = avg_value / avg_cost if avg_cost > 0 else 0
    
    doc.append("### Average Scores")
    doc.append("")
    doc.append(f"- **Average expected_value_score:** {avg_value:.2f}")
    doc.append(f"- **Average expected_cost_score:** {avg_cost:.2f}")
    doc.append(f"- **Average value_cost_ratio:** {avg_ratio:.2f}")
    doc.append("")
    
    # Social Trends Note
    doc.append("---")
    doc.append("")
    doc.append("## Note on Social Data Sources")
    doc.append("")
    doc.append("All social sentiment and trend analysis prompts use **SocialTrendsClient** as the data source abstraction. This client aggregates signals from multiple social platforms and trend sources, providing a unified interface for social sentiment analysis.")
    doc.append("")
    doc.append("The following prompts use SocialTrendsClient:")
    doc.append("")
    doc.append("- `social_sentiment_scanner`")
    doc.append("- `socialtrends_copytrading_scraper`")
    doc.append("- `reddit_memestock_scraper`")
    doc.append("")
    doc.append("**Note:** The prompt `twitter_copytrading_scraper` is **deprecated** and should be replaced with `socialtrends_copytrading_scraper`. It is maintained only for backward compatibility.")
    doc.append("")
    
    return "\n".join(doc)


if __name__ == "__main__":
    catalog = generate_catalog()
    
    # Write to file
    output_path = "/home/ubuntu/Prompt_flow/docs/PROMPT_CATALOG_INSTITUTIONAL.md"
    with open(output_path, "w") as f:
        f.write(catalog)
    
    print(f"Generated institutional catalog: {output_path}")
    print(f"Total prompts: {len(PROMPT_METADATA)}")
