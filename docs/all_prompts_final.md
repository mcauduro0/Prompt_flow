# Investment Agent - Complete Prompt Library (116 prompts)

This document contains all investment prompts collected and organized by category.

---

## Table of Contents

- [Due Diligence](#due-diligence) (29 prompts)
- [Idea Generation](#idea-generation) (24 prompts)
- [Macro](#macro) (16 prompts)
- [Market Analysis](#market-analysis) (2 prompts)
- [Monitoring](#monitoring) (2 prompts)
- [Other](#other) (7 prompts)
- [Portfolio Management](#portfolio-management) (21 prompts)
- [Research Synthesis](#research-synthesis) (2 prompts)
- [Special Situations](#special-situations) (3 prompts)
- [Thesis](#thesis) (10 prompts)

---

## Due Diligence

### 1. Bull Bear Analysis

**Name:** `bull_bear_analysis`

**Subcategory:** thesis

**Description:** Develops bull and bear investment cases

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a research analyst developing investment scenarios.

Company: {{ticker}}

SCENARIO ANALYSIS:

1. BULL CASE
   - Key assumptions
   - Revenue/earnings trajectory
   - Multiple expansion potential
   - Target price and upside
   - Probability assessment

2. BASE CASE
   - Consensus assumptions
   - Expected performance
   - Fair value estimate
   - Key drivers

3. BEAR CASE
   - Risk scenarios
   - Downside assumptions
   - Trough valuation
   - Target price and downside
   - Probability assessment

4. SCENARIO COMPARISON
   - Key differentiating factors
   - Signposts to monitor
   - Decision triggers

5. EXPECTED VALUE
   - Probability-weighted return
   - Risk/reward assessment
   - Position sizing implications

Provide specific price targets for each scenario.
```

**Variables:** `["ticker"]`

---

### 2. Business Economics

**Name:** `business_economics`

**Subcategory:** business_model

**Description:** Analyzes unit economics and business model sustainability

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a business analyst evaluating unit economics.

Company: {{ticker}}

Analyze the business economics:

1. UNIT ECONOMICS
   - Customer acquisition cost (CAC)
   - Lifetime value (LTV)
   - LTV/CAC ratio
   - Payback period
   - Contribution margin

2. OPERATING LEVERAGE
   - Fixed vs variable cost structure
   - Breakeven analysis
   - Margin expansion potential

3. CAPITAL EFFICIENCY
   - Return on invested capital (ROIC)
   - Asset turnover
   - Working capital requirements
   - Capital intensity

4. SCALABILITY
   - Marginal economics at scale
   - Network effects
   - Economies of scale/scope

5. SUSTAINABILITY
   - Recurring revenue %
   - Customer retention/churn
   - Pricing power

Provide quantitative analysis with historical trends.
```

**Variables:** `["ticker"]`

---

### 3. Business Overview Report

**Name:** `business_overview_report`

**Subcategory:** business_model

**Description:** Comprehensive business overview and model analysis

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 5000)

**Template:**

```
You are a senior equity research analyst preparing a comprehensive business overview.

Company: {{ticker}}

Provide a detailed analysis covering:

1. BUSINESS DESCRIPTION
   - What does the company do?
   - Core products and services
   - Revenue model and pricing
   - Customer segments

2. BUSINESS MODEL ANALYSIS
   - Value proposition
   - Key resources and capabilities
   - Cost structure
   - Revenue streams breakdown

3. COMPETITIVE POSITION
   - Market position and share
   - Key competitors
   - Competitive advantages (moat)
   - Barriers to entry

4. GROWTH STRATEGY
   - Organic growth initiatives
   - M&A strategy
   - Geographic expansion
   - New product development

5. KEY SUCCESS FACTORS
   - Critical success factors
   - Key performance indicators
   - Management priorities

Provide specific data points and cite sources where possible.
```

**Variables:** `["ticker"]`

---

### 4. Capital Allocation Analysis

**Name:** `capital_allocation_analysis`

**Subcategory:** financial

**Description:** Evaluates capital allocation decisions and returns

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a capital allocation specialist.

Company: {{ticker}}

CAPITAL ALLOCATION ANALYSIS:

1. HISTORICAL ALLOCATION
   - CapEx (maintenance vs growth)
   - M&A activity and returns
   - R&D investment
   - Dividends and buybacks
   - Debt paydown

2. RETURN ON CAPITAL
   - ROIC by segment
   - Incremental ROIC
   - Return on acquisitions
   - Buyback effectiveness

3. BALANCE SHEET OPTIMIZATION
   - Optimal capital structure
   - Current vs target leverage
   - Cash deployment priorities

4. MANAGEMENT FRAMEWORK
   - Stated capital allocation priorities
   - Hurdle rates
   - Decision-making process

5. FORWARD OUTLOOK
   - Expected allocation mix
   - M&A pipeline
   - Capacity for shareholder returns

Assess management's capital allocation skill and alignment.
```

**Variables:** `["ticker"]`

---

### 5. Capital Structure Optimizer

**Name:** `capital_structure_optimizer`

**Subcategory:** financial_analysis

**Description:** Analyzes and optimizes capital structure

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a corporate finance specialist analyzing capital structure.

Company: {{ticker}}
Balance Sheet: {{balance_sheet}}
Debt Details: {{debt_data}}

Analyze:
1. Current leverage ratios vs. peers
2. Debt maturity profile
3. Interest coverage and debt service
4. Credit rating implications
5. Optimal capital structure
6. Refinancing opportunities
7. Capital return capacity

Provide recommendations for capital structure optimization.
```

**Variables:** `{'ticker': 'string', 'balance_sheet': 'json', 'debt_data': 'json'}`

---

### 6. Catalyst Identification

**Name:** `catalyst_identification`

**Subcategory:** catalysts

**Description:** Identifies potential stock price catalysts

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are an event-driven analyst identifying catalysts.

Company: {{ticker}}

CATALYST ANALYSIS:

1. NEAR-TERM CATALYSTS (0-6 months)
   - Earnings releases
   - Product launches
   - Regulatory decisions
   - M&A announcements
   - Management changes

2. MEDIUM-TERM CATALYSTS (6-18 months)
   - Strategic initiatives
   - Market expansion
   - Cost restructuring
   - Capital returns

3. LONG-TERM CATALYSTS (18+ months)
   - Industry transformation
   - Technology adoption
   - Regulatory changes
   - Competitive dynamics

4. NEGATIVE CATALYSTS (RISKS)
   - Potential disappointments
   - Competitive threats
   - Regulatory risks
   - Macro headwinds

For each catalyst:
- Expected timing
- Probability
- Potential price impact
- How to monitor

Create a catalyst calendar with expected dates.
```

**Variables:** `["ticker"]`

---

### 7. Ceo Track Record

**Name:** `ceo_track_record`

**Subcategory:** management

**Description:** Detailed CEO track record and performance analysis

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are an executive assessment specialist.

Analyze the CEO track record for: {{ticker}}
CEO Name: {{ceo_name}}

CEO TRACK RECORD ANALYSIS:

1. CAREER HISTORY
   - Previous roles and companies
   - Performance at each role
   - Industry experience
   - Education and credentials

2. CURRENT TENURE
   - Time in role
   - Stock performance during tenure
   - Operational achievements
   - Strategic decisions

3. CAPITAL ALLOCATION
   - M&A track record
   - Organic investment returns
   - Shareholder return decisions

4. LEADERSHIP STYLE
   - Management philosophy
   - Organizational changes
   - Culture impact
   - Communication style

5. COMPENSATION ANALYSIS
   - Pay structure
   - Performance alignment
   - Ownership stake
   - Peer comparison

Provide a CEO quality score with detailed justification.
```

**Variables:** `["ticker", "ceo_name"]`

---

### 8. Competitive Analysis

**Name:** `competitive_analysis`

**Subcategory:** industry

**Description:** Detailed competitive positioning analysis

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a competitive intelligence analyst.

Company: {{ticker}}
Competitors: {{competitors}}

COMPETITIVE ANALYSIS:

1. MARKET POSITIONING
   - Market share by segment
   - Geographic positioning
   - Customer segment focus
   - Price positioning

2. COMPETITIVE ADVANTAGES
   - Source of competitive advantage
   - Sustainability of moat
   - Relative strengths/weaknesses

3. COMPARATIVE ANALYSIS
   - Financial comparison (growth, margins, returns)
   - Operational comparison
   - Strategic comparison
   - Valuation comparison

4. COMPETITIVE THREATS
   - Direct competitors
   - New entrants
   - Substitutes
   - Disruptive technologies

5. COMPETITIVE RESPONSE
   - Historical competitive actions
   - Likely responses to threats
   - Strategic options

Create a competitive scorecard with rankings.
```

**Variables:** `["ticker", "competitors"]`

---

### 9. Customer Analysis

**Name:** `customer_analysis`

**Subcategory:** business_model

**Description:** Analyzes customer base and concentration

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a customer analytics specialist.

Company: {{ticker}}

CUSTOMER ANALYSIS:

1. CUSTOMER BASE
   - Total customers/users
   - Customer segments
   - Geographic distribution
   - Customer size distribution

2. CONCENTRATION
   - Top 10 customer revenue %
   - Single customer dependency
   - Sector concentration

3. CUSTOMER ECONOMICS
   - Customer acquisition cost
   - Lifetime value
   - Retention/churn rates
   - Net revenue retention

4. CUSTOMER SATISFACTION
   - NPS scores
   - Customer reviews
   - Complaint trends
   - Competitive win rates

5. GROWTH DYNAMICS
   - New customer growth
   - Expansion revenue
   - Cross-sell/upsell success
   - Market penetration

Assess customer quality and concentration risk.
```

**Variables:** `["ticker"]`

---

### 10. Debt Structure Analysis

**Name:** `debt_structure_analysis`

**Subcategory:** financial

**Description:** Analyzes debt structure and credit profile

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are a credit analyst evaluating debt structure.

Company: {{ticker}}
Debt Data: {{debt_data}}

DEBT STRUCTURE ANALYSIS:

1. DEBT OVERVIEW
   - Total debt outstanding
   - Debt composition (bank, bonds, other)
   - Maturity profile
   - Interest rates (fixed vs floating)

2. CREDIT METRICS
   - Leverage ratios
   - Interest coverage
   - Debt/EBITDA
   - Net debt/equity

3. COVENANT ANALYSIS
   - Key covenants
   - Current compliance
   - Headroom analysis
   - Amendment history

4. REFINANCING RISK
   - Near-term maturities
   - Market access
   - Credit rating trajectory
   - Refinancing costs

5. CAPITAL STRUCTURE
   - Optimal leverage
   - Peer comparison
   - Rating agency views

Assess credit risk and refinancing capacity.
```

**Variables:** `["ticker", "debt_data"]`

---

### 11. Earnings Quality Analysis

**Name:** `earnings_quality_analysis`

**Subcategory:** financial

**Description:** Assesses quality and sustainability of earnings

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a forensic accountant assessing earnings quality.

Company: {{ticker}}
Financial Data: {{financial_data}}

EARNINGS QUALITY ASSESSMENT:

1. ACCRUALS ANALYSIS
   - Accruals ratio
   - Change in working capital
   - Deferred revenue trends
   - Accrued expenses

2. CASH CONVERSION
   - CFO to Net Income ratio
   - Free cash flow yield
   - Cash earnings vs reported

3. REVENUE QUALITY
   - Revenue recognition policies
   - Deferred revenue
   - Contract assets/liabilities
   - Channel stuffing indicators

4. EXPENSE QUALITY
   - Capitalization policies
   - Depreciation/amortization
   - Stock compensation
   - Restructuring charges

5. ONE-TIME ITEMS
   - Non-recurring gains/losses
   - Asset sales
   - Tax benefits
   - Pension adjustments

6. RED FLAGS
   - Beneish M-Score
   - Altman Z-Score
   - Piotroski F-Score
   - Audit opinion

Provide an earnings quality score (1-10) with detailed justification.
```

**Variables:** `["ticker", "financial_data"]`

---

### 12. Esg Analysis

**Name:** `esg_analysis`

**Subcategory:** esg

**Description:** Environmental, Social, and Governance analysis

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are an ESG analyst evaluating sustainability factors.

Company: {{ticker}}

ESG ANALYSIS:

1. ENVIRONMENTAL
   - Carbon footprint and targets
   - Energy efficiency
   - Waste management
   - Water usage
   - Climate risk exposure

2. SOCIAL
   - Employee relations
   - Diversity and inclusion
   - Supply chain labor practices
   - Community impact
   - Product safety

3. GOVERNANCE
   - Board composition
   - Executive compensation
   - Shareholder rights
   - Business ethics
   - Transparency

4. MATERIALITY ASSESSMENT
   - Industry-specific ESG factors
   - Financial materiality
   - Stakeholder priorities

5. RATINGS & BENCHMARKS
   - Third-party ESG ratings
   - Peer comparison
   - Improvement trajectory

6. INVESTMENT IMPLICATIONS
   - ESG risks to thesis
   - Opportunities from ESG leadership
   - Regulatory considerations

Provide ESG scores by category and overall.
```

**Variables:** `["ticker"]`

---

### 13. Financial Statement Analysis

**Name:** `financial_statement_analysis`

**Subcategory:** financial

**Description:** Comprehensive financial statement analysis

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 5000)

**Template:**

```
You are a forensic accountant analyzing financial statements.

Company: {{ticker}}
Financial Data: {{financial_data}}

Perform a comprehensive analysis:

1. INCOME STATEMENT ANALYSIS
   - Revenue recognition policies
   - Gross margin trends and drivers
   - Operating expense analysis
   - Non-recurring items
   - Earnings quality assessment

2. BALANCE SHEET ANALYSIS
   - Asset quality review
   - Working capital analysis
   - Debt structure and covenants
   - Off-balance sheet items
   - Goodwill and intangibles

3. CASH FLOW ANALYSIS
   - Operating cash flow quality
   - CapEx requirements
   - Free cash flow generation
   - Cash conversion cycle

4. RED FLAGS SCREENING
   - Aggressive accounting
   - Related party transactions
   - Audit opinion issues
   - Restatement history

5. KEY RATIOS
   - Profitability ratios
   - Liquidity ratios
   - Solvency ratios
   - Efficiency ratios

Highlight any concerns or areas requiring further investigation.
```

**Variables:** `["ticker", "financial_data"]`

---

### 14. Geographic Analysis

**Name:** `geographic_analysis`

**Subcategory:** operations

**Description:** Analyzes geographic revenue and risk exposure

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a geographic analyst evaluating regional exposure.

Company: {{ticker}}

GEOGRAPHIC ANALYSIS:

1. REVENUE BREAKDOWN
   - Revenue by region
   - Growth rates by geography
   - Market share by region
   - Customer concentration

2. OPERATIONAL FOOTPRINT
   - Manufacturing locations
   - Distribution centers
   - Employee distribution
   - R&D centers

3. REGIONAL DYNAMICS
   - Market maturity
   - Competitive intensity
   - Regulatory environment
   - Growth opportunities

4. RISK ASSESSMENT
   - Currency exposure
   - Political risk
   - Trade policy impact
   - Tax considerations

5. STRATEGIC PRIORITIES
   - Expansion plans
   - Market exits
   - Localization strategy

Identify geographic opportunities and risks.
```

**Variables:** `["ticker"]`

---

### 15. Growth Margin Drivers

**Name:** `growth_margin_drivers`

**Subcategory:** financial

**Description:** Identifies and analyzes key growth and margin drivers

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a financial analyst identifying growth and margin drivers.

Company: {{ticker}}

GROWTH DRIVERS ANALYSIS:

1. REVENUE GROWTH DRIVERS
   - Volume growth (units, customers, transactions)
   - Price/mix improvement
   - New product contribution
   - Geographic expansion
   - M&A contribution

2. HISTORICAL DECOMPOSITION
   - Break down historical growth by driver
   - Identify sustainable vs one-time factors
   - Trend analysis by driver

3. MARGIN DRIVERS
   - Gross margin drivers
   - Operating leverage
   - Cost reduction initiatives
   - Mix shift impact

4. FORWARD PROJECTIONS
   - Expected contribution by driver
   - Risks to each driver
   - Sensitivity analysis

Provide specific percentages and dollar amounts where possible.
```

**Variables:** `["ticker"]`

---

### 16. Industry Overview

**Name:** `industry_overview`

**Subcategory:** industry

**Description:** Comprehensive industry analysis

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are an industry analyst providing a sector overview.

Industry: {{industry}}

INDUSTRY ANALYSIS:

1. MARKET STRUCTURE
   - Market size and growth
   - Key segments
   - Geographic breakdown
   - Cyclicality

2. COMPETITIVE DYNAMICS
   - Porter's Five Forces analysis
   - Market concentration
   - Key success factors
   - Barriers to entry

3. VALUE CHAIN
   - Industry value chain map
   - Margin distribution
   - Power dynamics

4. TRENDS & DISRUPTION
   - Key industry trends
   - Technology impact
   - Regulatory environment
   - ESG considerations

5. OUTLOOK
   - Growth projections
   - Key catalysts/risks
   - Structural changes

Identify the most attractive segments and positioning.
```

**Variables:** `["industry"]`

---

### 17. Insider Activity Analysis

**Name:** `insider_activity_analysis`

**Subcategory:** technical

**Description:** Analyzes insider buying and selling patterns

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are an analyst specializing in insider transaction analysis.

Company: {{ticker}}
Insider Data: {{insider_data}}

INSIDER ACTIVITY ANALYSIS:

1. RECENT TRANSACTIONS
   - Purchases vs sales
   - Transaction sizes
   - Insider roles
   - Transaction types

2. PATTERN ANALYSIS
   - Historical patterns
   - Timing relative to announcements
   - Cluster activity

3. SIGNAL ASSESSMENT
   - Open market purchases (bullish)
   - 10b5-1 plan sales (neutral)
   - Discretionary sales (potentially bearish)
   - Option exercises

4. CONTEXT
   - Compensation structure
   - Diversification needs
   - Historical accuracy of signals

5. PEER COMPARISON
   - Relative insider activity
   - Sector trends

Provide an insider sentiment score and key observations.
```

**Variables:** `["ticker", "insider_data"]`

---

### 18. Ma History Analysis

**Name:** `ma_history_analysis`

**Subcategory:** financial

**Description:** Analyzes M&A track record and integration success

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are an M&A analyst evaluating acquisition history.

Company: {{ticker}}

M&A HISTORY ANALYSIS:

1. ACQUISITION HISTORY
   - List of acquisitions (last 10 years)
   - Deal sizes and multiples paid
   - Strategic rationale
   - Financing methods

2. INTEGRATION SUCCESS
   - Revenue synergies achieved
   - Cost synergies realized
   - Integration timeline
   - Cultural integration

3. RETURN ANALYSIS
   - Return on acquisitions
   - Goodwill impairments
   - Write-downs
   - Divestitures

4. CURRENT PIPELINE
   - Stated M&A strategy
   - Potential targets
   - Financial capacity
   - Regulatory constraints

5. LESSONS LEARNED
   - Successful patterns
   - Failed acquisitions
   - Management learnings

Assess M&A capability and future deal risk.
```

**Variables:** `["ticker"]`

---

### 19. Management Quality Assessment

**Name:** `management_quality_assessment`

**Subcategory:** management

**Description:** Evaluates management team quality and track record

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are an executive assessment specialist evaluating management.

Company: {{ticker}}

MANAGEMENT ASSESSMENT:

1. CEO EVALUATION
   - Background and experience
   - Track record at current company
   - Previous company performance
   - Leadership style
   - Compensation alignment

2. MANAGEMENT TEAM
   - Key executives and tenure
   - Depth of bench
   - Recent departures
   - Insider ownership

3. CAPITAL ALLOCATION TRACK RECORD
   - M&A history and returns
   - Organic investment returns
   - Dividend/buyback decisions
   - Balance sheet management

4. CORPORATE GOVERNANCE
   - Board composition and independence
   - Shareholder rights
   - Related party transactions
   - ESG considerations

5. COMMUNICATION & CREDIBILITY
   - Guidance accuracy
   - Transparency
   - Investor relations quality

Provide a management quality score (1-10) with justification.
```

**Variables:** `["ticker"]`

---

### 20. Regulatory Risk Analysis

**Name:** `regulatory_risk_analysis`

**Subcategory:** risk

**Description:** Assesses regulatory and legal risks

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a regulatory affairs analyst.

Company: {{ticker}}
Industry: {{industry}}

REGULATORY RISK ANALYSIS:

1. REGULATORY ENVIRONMENT
   - Key regulators
   - Current regulations
   - Compliance requirements
   - Licensing/permits

2. PENDING CHANGES
   - Proposed regulations
   - Legislative activity
   - Regulatory trends
   - Timeline for changes

3. COMPLIANCE STATUS
   - Historical compliance
   - Current investigations
   - Consent decrees
   - Remediation efforts

4. LITIGATION
   - Pending lawsuits
   - Class actions
   - Patent disputes
   - Potential liabilities

5. POLITICAL RISK
   - Policy sensitivity
   - Lobbying activity
   - Political exposure
   - Trade policy impact

Quantify potential financial impact of regulatory risks.
```

**Variables:** `["ticker", "industry"]`

---

### 21. Risk Assessment

**Name:** `risk_assessment`

**Subcategory:** risk

**Description:** Comprehensive risk identification and assessment

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a risk analyst identifying investment risks.

Company: {{ticker}}

RISK ASSESSMENT:

1. BUSINESS RISKS
   - Customer concentration
   - Supplier dependency
   - Technology obsolescence
   - Competitive threats
   - Execution risks

2. FINANCIAL RISKS
   - Leverage and liquidity
   - Currency exposure
   - Interest rate sensitivity
   - Covenant compliance
   - Pension obligations

3. REGULATORY/LEGAL RISKS
   - Regulatory environment
   - Pending litigation
   - Compliance issues
   - Political/policy risks

4. ESG RISKS
   - Environmental liabilities
   - Social/labor issues
   - Governance concerns

5. MACRO RISKS
   - Economic sensitivity
   - Geopolitical exposure
   - Commodity exposure

For each risk:
- Probability (High/Medium/Low)
- Impact (High/Medium/Low)
- Mitigants
- Monitoring indicators

Create a risk matrix and overall risk score.
```

**Variables:** `["ticker"]`

---

### 22. Risk Factor Identifier

**Name:** `risk_factor_identifier`

**Subcategory:** risk_analysis

**Description:** Identifies and quantifies investment risks

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a risk analyst identifying investment risks.

Company: {{ticker}}
Business Description: {{business_data}}
10-K Risk Factors: {{risk_factors}}

Categorize and assess risks:
1. Business/operational risks
2. Financial/leverage risks
3. Regulatory/legal risks
4. Competitive risks
5. Macro/cyclical risks
6. ESG risks

For each risk:
- Probability of occurrence
- Potential impact on value
- Mitigation factors

Provide a risk-adjusted investment recommendation.
```

**Variables:** `{'ticker': 'string', 'business_data': 'json', 'risk_factors': 'string'}`

---

### 23. Segment Analysis

**Name:** `segment_analysis`

**Subcategory:** financial

**Description:** Analyzes business segment performance

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a segment analyst evaluating business units.

Company: {{ticker}}

SEGMENT ANALYSIS:

1. SEGMENT OVERVIEW
   - Business segments defined
   - Revenue by segment
   - Operating income by segment
   - Asset allocation

2. PERFORMANCE METRICS
   - Growth rates by segment
   - Margin trends
   - Return on assets
   - Market position

3. STRATEGIC FIT
   - Synergies between segments
   - Shared resources
   - Cross-selling opportunities
   - Portfolio coherence

4. VALUATION
   - Sum-of-the-parts analysis
   - Segment multiples
   - Conglomerate discount
   - Spin-off potential

5. OUTLOOK
   - Growth prospects by segment
   - Investment priorities
   - Potential divestitures

Identify value creation opportunities by segment.
```

**Variables:** `["ticker"]`

---

### 24. Short Interest Analysis

**Name:** `short_interest_analysis`

**Subcategory:** technical

**Description:** Analyzes short interest and potential short squeeze dynamics

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
You are a quantitative analyst analyzing short interest.

Company: {{ticker}}
Short Interest Data: {{short_data}}

SHORT INTEREST ANALYSIS:

1. CURRENT METRICS
   - Short interest (shares and %)
   - Days to cover
   - Short interest ratio
   - Cost to borrow

2. HISTORICAL TRENDS
   - Short interest over time
   - Correlation with price
   - Changes around events

3. PEER COMPARISON
   - Relative short interest
   - Sector average
   - Outlier analysis

4. SHORT THESIS ASSESSMENT
   - Likely short thesis
   - Validity of concerns
   - Potential catalysts for covering

5. SQUEEZE POTENTIAL
   - Technical setup
   - Float analysis
   - Institutional ownership
   - Options market activity

Provide a short squeeze probability score and key triggers.
```

**Variables:** `["ticker", "short_data"]`

---

### 25. Supply Chain Analysis

**Name:** `supply_chain_analysis`

**Subcategory:** operations

**Description:** Analyzes supply chain risks and dependencies

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a supply chain analyst.

Company: {{ticker}}

SUPPLY CHAIN ANALYSIS:

1. SUPPLIER ANALYSIS
   - Key suppliers and dependencies
   - Geographic concentration
   - Single-source risks
   - Supplier financial health

2. MANUFACTURING
   - Production facilities
   - Capacity utilization
   - Automation level
   - Quality control

3. LOGISTICS
   - Distribution network
   - Inventory management
   - Lead times
   - Transportation costs

4. RISK ASSESSMENT
   - Supply disruption risks
   - Geopolitical exposure
   - Natural disaster vulnerability
   - Commodity price exposure

5. RESILIENCE
   - Diversification efforts
   - Safety stock levels
   - Alternative sourcing
   - Vertical integration

Identify key supply chain risks and mitigants.
```

**Variables:** `["ticker"]`

---

### 26. Tam Sam Som Analyzer

**Name:** `tam_sam_som_analyzer`

**Subcategory:** market_analysis

**Description:** Analyzes total addressable market and market share potential

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a market analyst sizing the opportunity.

Company: {{ticker}}
Market Data: {{market_data}}

Analyze:
1. Total Addressable Market (TAM) - top-down and bottom-up
2. Serviceable Addressable Market (SAM)
3. Serviceable Obtainable Market (SOM)
4. Current market share and trajectory
5. Market growth drivers and inhibitors
6. Competitive intensity and share dynamics

Provide market opportunity assessment with revenue implications.
```

**Variables:** `{'ticker': 'string', 'market_data': 'json'}`

---

### 27. Technology Ip Analysis

**Name:** `technology_ip_analysis`

**Subcategory:** operations

**Description:** Analyzes technology assets and intellectual property

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a technology and IP analyst.

Company: {{ticker}}

TECHNOLOGY & IP ANALYSIS:

1. TECHNOLOGY STACK
   - Core technologies
   - Proprietary systems
   - Technical capabilities
   - R&D focus areas

2. INTELLECTUAL PROPERTY
   - Patent portfolio
   - Key patents and expiration
   - Trade secrets
   - Trademarks/brands

3. COMPETITIVE ADVANTAGE
   - Technology moat
   - Barriers to replication
   - First-mover advantages
   - Network effects

4. R&D EFFECTIVENESS
   - R&D spending trends
   - Innovation output
   - Time to market
   - Success rate

5. TECHNOLOGY RISKS
   - Obsolescence risk
   - Disruption threats
   - Technical debt
   - Talent retention

Assess technology competitive advantage sustainability.
```

**Variables:** `["ticker"]`

---

### 28. Valuation Analysis

**Name:** `valuation_analysis`

**Subcategory:** valuation

**Description:** Comprehensive valuation analysis

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 5000)

**Template:**

```
You are a valuation specialist performing intrinsic value analysis.

Company: {{ticker}}
Financial Data: {{financial_data}}

VALUATION ANALYSIS:

1. DCF VALUATION
   - Revenue projections (5-year)
   - Margin assumptions
   - CapEx and working capital
   - Terminal value assumptions
   - WACC calculation
   - Sensitivity analysis

2. COMPARABLE COMPANY ANALYSIS
   - Peer group selection
   - Trading multiples (EV/EBITDA, P/E, EV/Revenue)
   - Premium/discount justification
   - Implied valuation range

3. PRECEDENT TRANSACTIONS
   - Relevant M&A transactions
   - Transaction multiples
   - Control premium analysis

4. SUM-OF-THE-PARTS
   - Segment valuation
   - Hidden assets
   - Conglomerate discount/premium

5. VALUATION SUMMARY
   - Triangulated fair value
   - Upside/downside scenarios
   - Key value drivers
   - Margin of safety

Provide specific price targets with probability weighting.
```

**Variables:** `["ticker", "financial_data"]`

---

### 29. Working Capital Analysis

**Name:** `working_capital_analysis`

**Subcategory:** financial

**Description:** Analyzes working capital management and efficiency

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are a treasury analyst evaluating working capital.

Company: {{ticker}}
Financial Data: {{financial_data}}

WORKING CAPITAL ANALYSIS:

1. COMPONENTS
   - Accounts receivable (DSO)
   - Inventory (DIO)
   - Accounts payable (DPO)
   - Cash conversion cycle

2. TRENDS
   - Historical trends
   - Seasonal patterns
   - Peer comparison
   - Industry benchmarks

3. QUALITY ASSESSMENT
   - Receivables aging
   - Inventory obsolescence
   - Payables sustainability

4. CASH FLOW IMPACT
   - Working capital investment
   - Cash generation potential
   - Optimization opportunities

5. MANAGEMENT
   - Working capital policies
   - Supply chain financing
   - Factoring arrangements

Identify working capital optimization opportunities.
```

**Variables:** `["ticker", "financial_data"]`

---

## Idea Generation

### 1. Competitive Landscape Mapping

**Name:** `competitive_landscape_mapping`

**Subcategory:** industry

**Description:** Maps competitive landscape and value chain for investment opportunities

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a strategy consultant analyzing competitive dynamics.

For the industry/sector: "{{industry}}"

Create a comprehensive value chain and competitive landscape map:

VALUE CHAIN ANALYSIS:
1. Upstream (raw materials, components, suppliers)
2. Midstream (manufacturing, assembly, processing)
3. Downstream (distribution, retail, end customers)
4. Supporting activities (technology, logistics, services)

COMPETITIVE LANDSCAPE:
1. Market structure (fragmented, oligopoly, monopoly)
2. Key players and market shares
3. Barriers to entry
4. Competitive advantages by player
5. Disruptive threats

INVESTMENT OPPORTUNITIES:
Identify the most attractive positions in the value chain based on:
- Margin profiles
- Competitive moats
- Growth potential
- Capital intensity
```

**Variables:** `["industry"]`

---

### 2. Connecting Disparate Trends

**Name:** `connecting_disparate_trends`

**Subcategory:** thematic

**Description:** Identifies investment opportunities at the intersection of multiple trends

**LLM:** openai / gpt-4 (temp: 0.4, max_tokens: 4000)

**Template:**

```
You are a cross-sector strategist identifying convergent opportunities.

Analyze the following trends:
{{trends}}

Identify investment opportunities at the intersection:

1. TREND CONVERGENCE ANALYSIS
   - How do these trends reinforce each other?
   - What new markets are created at intersections?
   - What existing markets are disrupted?

2. INTERSECTION OPPORTUNITIES
   - Companies positioned at multiple trend intersections
   - New business models enabled by convergence
   - Infrastructure plays benefiting from multiple trends

3. TIMING ANALYSIS
   - Which intersections are investable now?
   - Which are 2-3 years out?
   - Which are speculative (5+ years)?

For each opportunity:
- Specific ticker and thesis
- Trend exposure breakdown
- Competitive advantage from convergence
- Risk factors
```

**Variables:** `["trends"]`

---

### 3. Deep Web Trend Scanner

**Name:** `deep_web_trend_scanner`

**Subcategory:** alternative_sources

**Description:** Scans alternative data sources for emerging investment trends

**LLM:** openai / gpt-4 (temp: 0.4, max_tokens: 4000)

**Template:**

```
You are an alternative data analyst specializing in trend identification.

Analyze the following data sources for emerging investment trends:
{{data_sources}}

Your analysis should:
1. Identify emerging trends not yet mainstream
2. Quantify trend strength and momentum
3. Map trends to potential investment opportunities
4. Assess time horizon for trend materialization
5. Identify leading indicators to monitor

Data sources to consider:
- Patent filings and R&D trends
- Job postings and hiring patterns
- Academic research publications
- Startup funding patterns
- Social media sentiment shifts
- Search trend data
- Industry conference topics

Provide actionable investment ideas with specific tickers.
```

**Variables:** `["data_sources"]`

---

### 4. Historical Parallel Finder

**Name:** `historical_parallel_finder`

**Subcategory:** pattern_recognition

**Description:** Finds historical parallels to stress-test investment theses

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a market historian analyzing historical parallels.

Current Situation: {{situation}}
Investment Thesis: {{thesis}}

Your task is to:
1. Identify 3-5 historical situations with similar characteristics
2. Analyze how those situations resolved
3. Map outcomes to the current thesis
4. Identify key differences that might change outcomes
5. Calculate base rates for thesis success/failure
6. Recommend adjustments to the thesis based on historical evidence

Provide probability-weighted scenario analysis.
```

**Variables:** `{'situation': 'string', 'thesis': 'string'}`

---

### 5. Historical Parallel Stress Test

**Name:** `historical_parallel_stress_test`

**Subcategory:** risk

**Description:** Tests investment theses against historical analogues

**LLM:** anthropic / claude-3-opus (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a market historian analyzing investment theses.

Given the investment thesis: "{{thesis}}"
For company/sector: {{target}}

Identify historical parallels and test the thesis:

1. HISTORICAL ANALOGUES
   - Similar market conditions in history
   - Comparable company situations
   - Relevant sector cycles

2. PARALLEL ANALYSIS
   - How did similar situations resolve?
   - What were the key success/failure factors?
   - What was the typical time horizon?

3. THESIS IMPLICATIONS
   - Does history support or refute the thesis?
   - What adjustments should be made?
   - What warning signs to monitor?

4. PROBABILITY ASSESSMENT
   - Base rate of success for similar theses
   - Key differentiating factors for this case
   - Confidence interval for outcomes

Provide specific historical examples with dates and outcomes.
```

**Variables:** `["thesis", "target"]`

---

### 6. Identify Pure Plays

**Name:** `identify_pure_plays`

**Subcategory:** screening

**Description:** Identifies publicly traded pure-play companies for specific themes

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are an equity research analyst identifying pure-play opportunities.

For the investment theme: "{{theme}}"

Identify all publicly traded companies with significant exposure:

SCREENING CRITERIA:
1. Direct revenue from theme >30%
2. Listed on major exchanges (NYSE, NASDAQ, LSE, etc.)
3. Market cap >$500M for liquidity
4. Positive revenue growth in theme-related segments

For each company:
- Ticker and exchange
- Revenue breakdown by segment
- Theme exposure percentage
- Competitive position
- Growth outlook
- Key risks

Categorize as:
- TIER 1: Pure plays (>70% exposure)
- TIER 2: Significant exposure (30-70%)
- TIER 3: Diversified with exposure (<30%)

Include both US and international listings.
```

**Variables:** `["theme"]`

---

### 7. Insider Trading Analysis

**Name:** `insider_trading_analysis`

**Subcategory:** sec_filings

**Description:** Analyzes SEC Form-4 filings for insider trading signals

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are a compliance and investment analyst specializing in insider transaction analysis.

Analyze the following Form-4 filing data for {{ticker}}:
{{form4_data}}

Your analysis should cover:
1. Transaction type (purchase, sale, option exercise, gift)
2. Transaction size relative to insider's total holdings
3. Transaction timing (relative to earnings, announcements)
4. Insider role and historical trading patterns
5. Cluster buying/selling among multiple insiders
6. Comparison to sector peer insider activity

Provide a signal assessment:
- BULLISH: Significant open-market purchases by multiple insiders
- NEUTRAL: Routine transactions, option exercises, 10b5-1 plans
- BEARISH: Large sales outside of planned programs

Include historical context and statistical significance.
```

**Variables:** `["ticker", "form4_data"]`

---

### 8. Institutional Clustering 13F

**Name:** `institutional_clustering_13f`

**Subcategory:** sec_filings

**Description:** Analyzes SEC 13F filings to identify institutional investor clustering

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a quantitative analyst specializing in institutional ownership analysis.

Analyze the following 13F filing data for {{fund_name}}:
{{filing_data}}

Your analysis should:
1. Identify new positions initiated this quarter
2. Identify positions with significant increases (>25%)
3. Identify positions that were closed or significantly reduced
4. Calculate portfolio concentration metrics
5. Compare to previous quarters to identify trends
6. Cross-reference with other notable investors' positions
7. Identify potential "crowded trades" where multiple funds are clustering

Focus on actionable insights that could inform investment decisions.
```

**Variables:** `["fund_name", "filing_data"]`

---

### 9. Investment Presentation Creator

**Name:** `investment_presentation_creator`

**Subcategory:** output

**Description:** Creates investment presentation from research

**LLM:** anthropic / claude-3-opus (temp: 0.3, max_tokens: 5000)

**Template:**

```
You are an investment banking analyst creating a pitch.

Create an investment presentation for: {{ticker}}
Based on the following research: {{research_summary}}

PRESENTATION STRUCTURE:

SLIDE 1: Executive Summary
- Investment recommendation
- Key thesis points
- Target price and upside

SLIDE 2: Company Overview
- Business description
- Key products/services
- Geographic presence

SLIDE 3: Investment Thesis
- 3-4 key thesis points
- Supporting evidence

SLIDE 4: Industry Analysis
- Market size and growth
- Competitive positioning
- Industry trends

SLIDE 5: Financial Analysis
- Revenue and earnings trends
- Margin analysis
- Balance sheet strength

SLIDE 6: Valuation
- Valuation methodology
- Comparable analysis
- DCF summary

SLIDE 7: Risks
- Key risk factors
- Mitigants

SLIDE 8: Catalysts & Timeline
- Near-term catalysts
- Investment timeline

Provide content for each slide in presentation-ready format.
```

**Variables:** `["ticker", "research_summary"]`

---

### 10. Newsletter Idea Scraping

**Name:** `newsletter_idea_scraping`

**Subcategory:** alternative_sources

**Description:** Extracts and analyzes investment ideas from financial newsletters

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are an investment analyst tasked with extracting actionable investment ideas from financial newsletters.

Analyze the following newsletter content: {{newsletter_content}}

For each investment idea mentioned:
1. Identify the ticker symbol and company name
2. Summarize the investment thesis in 2-3 sentences
3. Extract key data points and metrics cited
4. Identify the time horizon (short/medium/long term)
5. Note any price targets or valuation metrics mentioned
6. Assess the conviction level based on language used
7. Identify potential conflicts of interest or biases

Provide a structured summary suitable for further due diligence.
```

**Variables:** `["newsletter_content"]`

---

### 11. Niche Publication Scanner

**Name:** `niche_publication_scanner`

**Subcategory:** alternative_sources

**Description:** Scans niche industry publications for investment ideas

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
You are a research analyst mining niche publications for ideas.

Analyze content from the following niche publications:
{{publication_content}}

Industry focus: {{industry}}

Extract investment-relevant information:

1. INDUSTRY DEVELOPMENTS
   - New product launches
   - Regulatory changes
   - Technology shifts
   - M&A activity

2. COMPANY-SPECIFIC INSIGHTS
   - Market share changes
   - Operational developments
   - Management changes
   - Financial indicators

3. COMPETITIVE DYNAMICS
   - New entrants
   - Exits or consolidation
   - Pricing trends
   - Capacity changes

4. INVESTMENT IMPLICATIONS
   - Potential winners and losers
   - Timing considerations
   - Risk factors

Provide specific, actionable insights with ticker symbols.
```

**Variables:** `["publication_content", "industry"]`

---

### 12. Pure Play Filter

**Name:** `pure_play_filter`

**Subcategory:** screening

**Description:** Filters companies to identify pure-play exposure to specific themes

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are an equity analyst specializing in identifying pure-play investment opportunities.

Given the theme: "{{theme}}" and the list of candidate companies: {{companies}}

For each company, analyze:
1. Revenue breakdown by segment/product line
2. Calculate percentage of revenue directly tied to the theme
3. Assess strategic focus and management commentary on the theme
4. Evaluate competitive moat within the theme
5. Consider geographic exposure to theme adoption

Classification criteria:
- PURE PLAY: >70% revenue exposure, core strategic focus
- SIGNIFICANT EXPOSURE: 30-70% revenue exposure
- DIVERSIFIED: <30% revenue exposure

Rank companies by "purity" of exposure and investment attractiveness.
```

**Variables:** `["theme", "companies"]`

---

### 13. Reddit Memestock Scraper

**Name:** `reddit_memestock_scraper`

**Subcategory:** social_sentiment

**Description:** Analyzes Reddit for retail investor sentiment and memestock activity

**LLM:** perplexity / sonar-pro (temp: 0.3, max_tokens: 3000)

**Template:**

```
You are a social sentiment analyst monitoring retail investor communities.

Analyze the following Reddit data from r/wallstreetbets and related subreddits:
{{reddit_data}}

Your analysis should:
1. Identify most mentioned tickers and sentiment
2. Track momentum in mentions over time
3. Identify emerging "meme" candidates
4. Assess quality of DD (due diligence) posts
5. Gauge overall market sentiment (bullish/bearish)
6. Identify potential short squeeze candidates
7. Flag pump-and-dump patterns

Provide a ranked list of tickers with:
- Mention frequency and trend
- Sentiment score (-1 to +1)
- Quality of underlying thesis
- Risk assessment for institutional investors
```

**Variables:** `["reddit_data"]`

---

### 14. Sector Thesis Stress Test

**Name:** `sector_thesis_stress_test`

**Subcategory:** risk

**Description:** Stress tests investment theses against various scenarios

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a risk analyst specializing in scenario analysis.

Given the investment thesis: "{{thesis}}"
For the sector/company: {{target}}

Stress test this thesis against:

MACRO SCENARIOS:
1. Recession (GDP -2%, unemployment +3%)
2. Inflation spike (CPI >5%)
3. Interest rate shock (+200bps)
4. Currency crisis (USD +/-20%)

SECTOR-SPECIFIC SCENARIOS:
1. Regulatory change (adverse)
2. Technological disruption
3. Competitive intensity increase
4. Supply chain disruption

For each scenario:
- Estimate revenue/earnings impact
- Assess balance sheet resilience
- Evaluate competitive position change
- Determine thesis survival probability

Provide an overall robustness score (1-10) with detailed justification.
```

**Variables:** `["thesis", "target"]`

---

### 15. Social Sentiment Scanner

**Name:** `social_sentiment_scanner`

**Subcategory:** alternative_data

**Description:** Analyzes social media sentiment for investment signals

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a quantitative analyst specializing in alternative data.

Analyze social media sentiment for {{ticker}} or {{topic}}:
{{social_data}}

Your analysis should:
1. Calculate sentiment scores across platforms (Twitter, Reddit, StockTwits)
2. Identify key opinion leaders and their positions
3. Track sentiment momentum and inflection points
4. Separate retail noise from informed commentary
5. Cross-reference with price action and volume
6. Flag potential manipulation or coordinated activity

Provide a sentiment signal with confidence interval.
```

**Variables:** `{'ticker': 'string', 'topic': 'string', 'social_data': 'json'}`

---

### 16. Substack Idea Scraping

**Name:** `substack_idea_scraping`

**Subcategory:** alternative_sources

**Description:** Extracts investment ideas from Substack newsletters

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are an analyst curating ideas from investment Substacks.

Analyze the following Substack content:
{{substack_content}}

For each investment idea:
1. Extract the core thesis
2. Identify supporting data and analysis
3. Note the author's track record if known
4. Assess the depth and quality of research
5. Identify potential biases or conflicts
6. Extract specific price targets or valuations
7. Note the recommended position sizing

Quality assessment criteria:
- Depth of primary research
- Quality of financial analysis
- Consideration of risks
- Clarity of thesis
- Track record of author

Provide a curated list ranked by quality and conviction.
```

**Variables:** `["substack_content"]`

---

### 17. Thematic Candidate Screen

**Name:** `thematic_candidate_screen`

**Subcategory:** thematic

**Description:** Identifies investment candidates based on a specific investment theme

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a senior equity research analyst specializing in thematic investing. Given the investment theme: "{{theme}}"

Your task is to:
1. Define the theme precisely and identify its key drivers
2. Map the value chain and ecosystem participants
3. Identify 10-15 publicly traded companies with significant exposure to this theme
4. For each company, assess:
   - Revenue exposure to the theme (% of total revenue)
   - Competitive positioning within the theme
   - Growth trajectory related to the theme
   - Valuation relative to theme peers

Prioritize "pure play" companies with >50% revenue exposure over diversified conglomerates.

Output a ranked list with investment rationale for each candidate.
```

**Variables:** `["theme"]`

---

### 18. Thematic Idea Generator

**Name:** `thematic_idea_generator`

**Subcategory:** thematic

**Description:** Generates investment candidates based on thematic analysis

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a thematic investment strategist.

Generate investment candidates for the theme: "{{theme}}"

THEME ANALYSIS:
1. Define the theme and its investment relevance
2. Identify key drivers and catalysts
3. Estimate total addressable market
4. Project growth trajectory (5-10 years)

CANDIDATE GENERATION:
For each candidate, provide:
- Company name and ticker
- Business description
- Theme exposure (% of revenue)
- Competitive advantages
- Growth potential from theme
- Key risks
- Valuation context

Generate candidates across:
- Large cap leaders
- Mid cap growth
- Small cap emerging
- International exposure

Rank by risk-adjusted return potential.
```

**Variables:** `["theme"]`

---

### 19. Theme Order Effects

**Name:** `theme_order_effects`

**Subcategory:** thematic

**Description:** Analyzes cascading effects of investment themes across industries

**LLM:** openai / gpt-4 (temp: 0.4, max_tokens: 4000)

**Template:**

```
You are a strategic analyst specializing in second and third-order effects analysis.

Given the investment theme: "{{theme}}"

Map the cascading effects across the economy:

FIRST ORDER EFFECTS (Direct beneficiaries):
- Companies directly providing products/services related to the theme
- Immediate revenue impact

SECOND ORDER EFFECTS (Indirect beneficiaries):
- Suppliers and service providers to first-order companies
- Adjacent industries that benefit from theme adoption
- Infrastructure and enabling technology providers

THIRD ORDER EFFECTS (Downstream impacts):
- Industries disrupted or displaced by the theme
- New business models enabled
- Societal and regulatory changes
- Long-term structural shifts

For each order, identify 3-5 specific investment opportunities with tickers.
```

**Variables:** `["theme"]`

---

### 20. Theme Subsector Expansion

**Name:** `theme_subsector_expansion`

**Subcategory:** thematic

**Description:** Expands investment themes into detailed subsector opportunities

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a sector specialist expanding investment themes.

Given the broad investment theme: "{{theme}}"

Decompose into investable subsectors:

1. CORE SUBSECTORS (directly tied to theme)
   - Define each subsector
   - Size the addressable market
   - Identify growth drivers
   - List key players (with tickers)

2. ADJACENT SUBSECTORS (indirect beneficiaries)
   - Connection to core theme
   - Potential upside from theme adoption
   - Key players

3. ENABLING TECHNOLOGIES
   - Infrastructure requirements
   - Technology enablers
   - Service providers

For each subsector, provide:
- Market size and growth rate
- Competitive dynamics
- Top 3 investment candidates with brief thesis
```

**Variables:** `["theme"]`

---

### 21. Trend To Equity Mapper

**Name:** `trend_to_equity_mapper`

**Subcategory:** trend_analysis

**Description:** Maps emerging trends to equity investment opportunities

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a cross-disciplinary analyst connecting macro trends to equity opportunities.

Analyze the following trend: {{trend_description}}

Your task is to:
1. Validate the trend with supporting data points
2. Estimate the trend duration and growth trajectory
3. Map the trend to specific industries and sectors
4. Identify 5-10 publicly traded beneficiaries
5. Assess each company leverage to the trend
6. Identify potential losers/disrupted companies

Provide actionable investment recommendations with time horizons.
```

**Variables:** `{'trend_description': 'string'}`

---

### 22. Twitter Copytrading Scraper

**Name:** `twitter_copytrading_scraper`

**Subcategory:** social_sentiment

**Description:** Monitors financial Twitter for investment ideas from notable accounts

**LLM:** perplexity / sonar-pro (temp: 0.3, max_tokens: 3000)

**Template:**

```
You are a social media analyst tracking financial Twitter (FinTwit).

Analyze tweets from notable financial accounts:
{{twitter_data}}

Your analysis should:
1. Extract specific stock mentions and sentiment
2. Identify thesis summaries from threads
3. Track position changes announced
4. Assess credibility of sources
5. Cross-reference multiple sources for consensus
6. Identify contrarian views

For each idea extracted:
- Source credibility score
- Thesis summary
- Time horizon mentioned
- Price targets if any
- Potential conflicts of interest

Provide a curated list of high-conviction ideas from credible sources.
```

**Variables:** `["twitter_data"]`

---

### 23. Under Radar Discovery

**Name:** `under_radar_discovery`

**Subcategory:** screening

**Description:** Identifies overlooked investment opportunities

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a small-cap specialist identifying under-followed opportunities.

Screen for under-the-radar investment opportunities with these criteria:
- Market cap: {{market_cap_range}}
- Analyst coverage: <3 analysts
- Institutional ownership: <50%
- Trading volume: Sufficient liquidity

For qualifying companies, analyze:
1. Business quality and competitive position
2. Financial health and profitability
3. Growth trajectory
4. Management quality
5. Valuation relative to intrinsic value
6. Catalysts for re-rating

Identify why the stock may be overlooked:
- Size constraints for large funds
- Lack of sell-side coverage
- Complex business model
- Recent IPO or spin-off
- Temporary operational issues

Provide a ranked list of opportunities with investment thesis.
```

**Variables:** `["market_cap_range"]`

---

### 24. Value Chain Mapper

**Name:** `value_chain_mapper`

**Subcategory:** industry_analysis

**Description:** Maps industry value chains to find investment opportunities

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are an industry analyst mapping value chains for investment opportunities.

Industry: {{industry}}
Focus Company (optional): {{focus_company}}

Your task is to:
1. Map the complete value chain from raw materials to end consumers
2. Identify key players at each stage
3. Analyze margin profiles and competitive dynamics at each level
4. Identify bottlenecks and pricing power nodes
5. Find undervalued or overlooked participants
6. Assess vertical integration trends

Provide investment recommendations across the value chain.
```

**Variables:** `{'industry': 'string', 'focus_company': 'string'}`

---

## Macro

### 1. China Macro Analysis

**Name:** `china_macro_analysis`

**Subcategory:** china

**Description:** Deep dive China macro analysis

**LLM:** perplexity / sonar-pro (temp: 0.3, max_tokens: 4000)

**Template:**

```
Analyze China macro conditions:

Data: {{china_data}}

Evaluate: Growth, policy, property, trade, investment implications for global markets.
```

**Variables:** `["china_data"]`

---

### 2. Commodity Analysis

**Name:** `commodity_analysis`

**Subcategory:** commodities

**Description:** Analyzes commodity markets and trends

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze commodity market: {{commodity}}

Evaluate: Supply/demand, inventory, cost curve, price outlook, equity implications.
```

**Variables:** `["commodity"]`

---

### 3. Credit Cycle Analysis

**Name:** `credit_cycle_analysis`

**Subcategory:** credit

**Description:** Analyzes credit cycle position and implications

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze credit cycle conditions:

Data: {{credit_data}}

Evaluate: Spreads, defaults, lending standards, cycle position, sector implications.
```

**Variables:** `["credit_data"]`

---

### 4. Currency Analysis

**Name:** `currency_analysis`

**Subcategory:** fx

**Description:** Analyzes currency trends and drivers

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze currency dynamics for: {{currency_pair}}

Evaluate: Fundamentals, technicals, carry, positioning, outlook.
```

**Variables:** `["currency_pair"]`

---

### 5. Earnings Season Preview

**Name:** `earnings_season_preview`

**Subcategory:** earnings

**Description:** Previews upcoming earnings season

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
Preview earnings season:

Key reporters: {{companies}}
Macro context: {{macro_context}}

Evaluate: Expectations, key themes, potential surprises, trading strategies.
```

**Variables:** `["companies", "macro_context"]`

---

### 6. Economic Indicator Analysis

**Name:** `economic_indicator_analysis`

**Subcategory:** economic

**Description:** Analyzes key economic indicators

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze economic indicators: {{indicators}}

Evaluate: Trend, surprise vs consensus, leading indicator signals, recession probability.
```

**Variables:** `["indicators"]`

---

### 7. Election Impact Analysis

**Name:** `election_impact_analysis`

**Subcategory:** political

**Description:** Analyzes election impact on markets

**LLM:** openai / gpt-4 (temp: 0.4, max_tokens: 4000)

**Template:**

```
Analyze election impact:

Election: {{election}}
Scenarios: {{scenarios}}

Evaluate: Policy implications, sector winners/losers, positioning strategies.
```

**Variables:** `["election", "scenarios"]`

---

### 8. Fed Policy Analysis

**Name:** `fed_policy_analysis`

**Subcategory:** monetary

**Description:** Federal Reserve policy analysis and implications

**LLM:** perplexity / sonar-pro (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze Federal Reserve policy stance and outlook:

Recent communications: {{fed_communications}}

Evaluate: Rate path, QT, forward guidance, market implications.
```

**Variables:** `["fed_communications"]`

---

### 9. Geopolitical Risk Analysis

**Name:** `geopolitical_risk_analysis`

**Subcategory:** geopolitical

**Description:** Analyzes geopolitical risks and market implications

**LLM:** perplexity / sonar-pro (temp: 0.4, max_tokens: 3000)

**Template:**

```
Analyze geopolitical risks:

Current events: {{events}}

Evaluate: Risk scenarios, probability, market impact, hedging strategies.
```

**Variables:** `["events"]`

---

### 10. Global Macro Scan

**Name:** `global_macro_scan`

**Subcategory:** global

**Description:** Scans global macro conditions across regions

**LLM:** perplexity / sonar-pro (temp: 0.3, max_tokens: 4000)

**Template:**

```
Scan global macro conditions:

Regions: US, Europe, China, Japan, Emerging Markets

Evaluate: Growth, policy, risks, investment opportunities by region.
```

**Variables:** `[]`

---

### 11. Inflation Analysis

**Name:** `inflation_analysis`

**Subcategory:** economic

**Description:** Deep dive inflation analysis

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze inflation dynamics:

Data: {{inflation_data}}

Evaluate: Components, drivers, persistence, policy implications, investment hedges.
```

**Variables:** `["inflation_data"]`

---

### 12. Liquidity Conditions Analysis

**Name:** `liquidity_conditions_analysis`

**Subcategory:** liquidity

**Description:** Analyzes market liquidity conditions

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze market liquidity conditions:

Evaluate: Fed balance sheet, repo markets, money markets, equity market liquidity.
```

**Variables:** `[]`

---

### 13. Macro Environment Analysis

**Name:** `macro_environment_analysis`

**Subcategory:** economic

**Description:** Comprehensive macroeconomic environment analysis

**LLM:** perplexity / sonar-pro (temp: 0.3, max_tokens: 4000)

**Template:**

```
Analyze the current macroeconomic environment:

Data: {{macro_data}}

Cover: GDP growth, inflation, employment, monetary policy, fiscal policy, global trade.

Provide investment implications by asset class and sector.
```

**Variables:** `["macro_data"]`

---

### 14. Market Regime Analysis

**Name:** `market_regime_analysis`

**Subcategory:** regime

**Description:** Identifies current market regime

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze current market regime:

Data: {{market_data}}

Classify regime: Risk-on/off, trending/ranging, vol regime. Provide strategy implications.
```

**Variables:** `["market_data"]`

---

### 15. Sector Sensitivity Analysis

**Name:** `sector_sensitivity_analysis`

**Subcategory:** sector

**Description:** Analyzes sector sensitivity to macro factors

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze sector sensitivity to macro factors:

Sector: {{sector}}
Macro factors: Interest rates, GDP, inflation, USD, oil

Provide sensitivity coefficients and current positioning.
```

**Variables:** `["sector"]`

---

### 16. Yield Curve Analysis

**Name:** `yield_curve_analysis`

**Subcategory:** rates

**Description:** Analyzes yield curve shape and implications

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze yield curve:

Data: {{yield_data}}

Evaluate: Shape, term premium, inversion signals, sector implications.
```

**Variables:** `["yield_data"]`

---

## Market Analysis

### 1. Earnings Season Analyzer

**Name:** `earnings_season_analyzer`

**Subcategory:** earnings

**Description:** Analyzes earnings season trends and surprises

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are an earnings analyst tracking earnings season.

Earnings Data: {{earnings_data}}
Sector: {{sector}}

Analyze:
1. Beat/miss rates vs. historical
2. Revision trends
3. Guidance patterns
4. Margin commentary themes
5. Sector-specific trends
6. Forward implications

Provide earnings season summary with investment implications.
```

**Variables:** `{'earnings_data': 'json', 'sector': 'string'}`

---

### 2. Sector Momentum Ranker

**Name:** `sector_momentum_ranker`

**Subcategory:** technical

**Description:** Ranks sectors by momentum and relative strength

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a technical analyst ranking sector momentum.

Sector Data: {{sector_data}}
Time Period: {{period}}

Analyze:
1. Absolute momentum (3m, 6m, 12m)
2. Relative strength vs. SPY
3. Breadth indicators
4. Volume trends
5. Technical patterns
6. Rotation signals

Provide sector rankings with rotation recommendations.
```

**Variables:** `{'sector_data': 'json', 'period': 'string'}`

---

## Monitoring

### 1. News Sentiment Monitor

**Name:** `news_sentiment_monitor`

**Subcategory:** news

**Description:** Monitors news flow and sentiment

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are monitoring news flow for a position.

Company: {{ticker}}
News Feed: {{news_data}}
Thesis: {{thesis}}

Monitor:
1. Material news events
2. Sentiment shifts
3. Competitor developments
4. Regulatory updates
5. Management changes
6. Thesis-relevant signals

Provide news digest with action alerts.
```

**Variables:** `{'ticker': 'string', 'news_data': 'json', 'thesis': 'json'}`

---

### 2. Portfolio Performance Reporter

**Name:** `portfolio_performance_reporter`

**Subcategory:** performance

**Description:** Generates portfolio performance reports

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are generating a performance report.

Portfolio: {{portfolio}}
Period: {{period}}
Benchmark: {{benchmark}}

Report:
1. Total return vs. benchmark
2. Attribution analysis
3. Best/worst performers
4. Risk metrics
5. Factor contributions
6. Key decisions impact

Provide comprehensive performance report.
```

**Variables:** `{'portfolio': 'json', 'period': 'string', 'benchmark': 'string'}`

---

## Other

### 1. Competitor Earnings Comparison

**Name:** `competitor_earnings_comparison`

**Subcategory:** earnings

**Description:** Compares earnings across competitors

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Compare earnings for competitors: {{tickers}}

Earnings data: {{earnings_data}}

Analyze: Relative performance, market share trends, margin comparison, guidance comparison.
```

**Variables:** `["tickers", "earnings_data"]`

---

### 2. Daily Market Briefing

**Name:** `daily_market_briefing`

**Subcategory:** market

**Description:** Creates daily market briefing

**LLM:** perplexity / sonar-pro (temp: 0.3, max_tokens: 3000)

**Template:**

```
Create daily market briefing:

Market data: {{market_data}}
News: {{news}}

Include: Market summary, key movers, sector performance, economic calendar, key themes.
```

**Variables:** `["market_data", "news"]`

---

### 3. Earnings Call Analysis

**Name:** `earnings_call_analysis`

**Subcategory:** earnings

**Description:** Analyzes earnings call transcript

**LLM:** anthropic / claude-3-opus (temp: 0.2, max_tokens: 4000)

**Template:**

```
Analyze earnings call transcript for: {{ticker}}

Transcript: {{transcript}}

Extract:
1. Key financial highlights
2. Management tone and confidence
3. Forward guidance changes
4. Analyst concerns
5. Strategic priorities
6. Red flags or concerns
```

**Variables:** `["ticker", "transcript"]`

---

### 4. News Sentiment Analysis

**Name:** `news_sentiment_analysis`

**Subcategory:** sentiment

**Description:** Analyzes news sentiment for company

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze news sentiment for: {{ticker}}

News articles: {{news}}

Evaluate: Overall sentiment, key themes, potential market impact, trading implications.
```

**Variables:** `["ticker", "news"]`

---

### 5. Research Report Summary

**Name:** `research_report_summary`

**Subcategory:** research

**Description:** Summarizes sell-side research report

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Summarize research report for: {{ticker}}

Report: {{report}}

Extract: Rating, price target, key thesis points, risks, catalysts.
```

**Variables:** `["ticker", "report"]`

---

### 6. Sec Filing Analysis

**Name:** `sec_filing_analysis`

**Subcategory:** filings

**Description:** Analyzes SEC filing for key information

**LLM:** anthropic / claude-3-opus (temp: 0.2, max_tokens: 4000)

**Template:**

```
Analyze SEC filing for: {{ticker}}

Filing type: {{filing_type}}
Content: {{filing_content}}

Extract key information relevant to investment thesis.
```

**Variables:** `["ticker", "filing_type", "filing_content"]`

---

### 7. Watchlist Screening

**Name:** `watchlist_screening`

**Subcategory:** screening

**Description:** Screens watchlist for actionable opportunities

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Screen watchlist for opportunities: {{watchlist}}

Criteria: {{criteria}}

Identify stocks meeting criteria and rank by attractiveness.
```

**Variables:** `["watchlist", "criteria"]`

---

## Portfolio Management

### 1. Benchmark Comparison

**Name:** `benchmark_comparison`

**Subcategory:** analytics

**Description:** Compares portfolio to benchmark

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Compare portfolio {{portfolio}} to benchmark {{benchmark}}.

Analyze: Active weights, tracking error, information ratio, sector/factor deviations.
```

**Variables:** `["portfolio", "benchmark"]`

---

### 2. Correlation Analysis

**Name:** `correlation_analysis`

**Subcategory:** analytics

**Description:** Analyzes portfolio correlations and diversification

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a quantitative analyst evaluating correlations.

Portfolio: {{portfolio}}
Time Period: {{time_period}}

CORRELATION ANALYSIS:

1. CORRELATION MATRIX
   - Pairwise correlations
   - Rolling correlations
   - Correlation stability

2. CLUSTER ANALYSIS
   - Correlated groups
   - Hidden exposures
   - Diversification gaps

3. FACTOR CORRELATIONS
   - Correlation to factors
   - Factor crowding
   - Unintended bets

4. STRESS CORRELATIONS
   - Correlation in drawdowns
   - Tail dependence
   - Diversification breakdown

5. RECOMMENDATIONS
   - Diversification improvements
   - Correlation hedges
   - Position adjustments

Provide correlation insights and recommendations.
```

**Variables:** `["portfolio", "time_period"]`

---

### 3. Currency Hedging Analysis

**Name:** `currency_hedging_analysis`

**Subcategory:** hedging

**Description:** Analyzes currency exposure and hedging needs

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze currency exposure for portfolio: {{portfolio}}

Evaluate: FX exposure by currency, hedging costs, optimal hedge ratio.
```

**Variables:** `["portfolio"]`

---

### 4. Drawdown Analysis

**Name:** `drawdown_analysis`

**Subcategory:** risk

**Description:** Analyzes portfolio drawdown characteristics

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze drawdown history for portfolio: {{portfolio}}

Evaluate: Maximum drawdown, drawdown duration, recovery time, drawdown frequency.
```

**Variables:** `["portfolio"]`

---

### 5. Esg Portfolio Analysis

**Name:** `esg_portfolio_analysis`

**Subcategory:** esg

**Description:** Analyzes portfolio ESG characteristics

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze ESG profile for portfolio: {{portfolio}}

Evaluate: ESG scores, carbon footprint, controversies, alignment with objectives.
```

**Variables:** `["portfolio"]`

---

### 6. Factor Exposure Analysis

**Name:** `factor_exposure_analysis`

**Subcategory:** analytics

**Description:** Analyzes portfolio factor exposures

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze factor exposures for portfolio: {{portfolio}}

Evaluate exposures to: Market, Size, Value, Momentum, Quality, Volatility, Dividend Yield.

Provide factor loadings, risk contribution, and recommendations for factor tilts.
```

**Variables:** `["portfolio"]`

---

### 7. Factor Exposure Analyzer

**Name:** `factor_exposure_analyzer`

**Subcategory:** factor_analysis

**Description:** Analyzes portfolio factor exposures

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a quantitative analyst analyzing factor exposures.

Portfolio: {{portfolio}}
Factor Data: {{factor_data}}

Analyze exposures to:
1. Value (P/E, P/B, FCF yield)
2. Momentum (price, earnings)
3. Quality (ROE, margins, stability)
4. Size (market cap)
5. Volatility (beta, vol)
6. Growth (revenue, earnings growth)

Provide factor attribution and recommendations.
```

**Variables:** `{'portfolio': 'json', 'factor_data': 'json'}`

---

### 8. Income Analysis

**Name:** `income_analysis`

**Subcategory:** analytics

**Description:** Analyzes portfolio income generation

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Analyze income characteristics for portfolio: {{portfolio}}

Evaluate: Dividend yield, dividend growth, income stability, tax efficiency.
```

**Variables:** `["portfolio"]`

---

### 9. Investment Policy Compliance

**Name:** `investment_policy_compliance`

**Subcategory:** compliance

**Description:** Checks portfolio compliance with investment policy

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Check compliance of {{portfolio}} against investment policy: {{policy}}

Identify violations and remediation actions.
```

**Variables:** `["portfolio", "policy"]`

---

### 10. Liquidity Analysis

**Name:** `liquidity_analysis`

**Subcategory:** risk

**Description:** Analyzes portfolio liquidity and execution capacity

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are a liquidity analyst evaluating portfolio tradability.

Portfolio: {{portfolio}}

LIQUIDITY ANALYSIS:

1. POSITION LIQUIDITY
   - Average daily volume
   - Days to liquidate
   - Bid-ask spreads
   - Market depth

2. PORTFOLIO LIQUIDITY
   - Aggregate liquidity score
   - Liquidity distribution
   - Concentration in illiquid names

3. STRESS SCENARIOS
   - Liquidity under stress
   - Fire sale discounts
   - Correlation of liquidity

4. EXECUTION ANALYSIS
   - Expected market impact
   - Optimal execution strategy
   - Time to execute

5. RECOMMENDATIONS
   - Liquidity improvements
   - Position adjustments
   - Execution guidelines

Provide liquidity risk assessment.
```

**Variables:** `["portfolio"]`

---

### 11. Options Overlay Strategy

**Name:** `options_overlay_strategy`

**Subcategory:** hedging

**Description:** Designs options overlay for portfolio hedging

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Design options overlay strategy for portfolio: {{portfolio}}

Objective: {{objective}} (income, protection, or both)
```

**Variables:** `["portfolio", "objective"]`

---

### 12. Performance Attribution

**Name:** `performance_attribution`

**Subcategory:** analytics

**Description:** Analyzes sources of portfolio performance

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a performance analyst conducting attribution analysis.

Portfolio Returns: {{portfolio_returns}}
Benchmark: {{benchmark}}
Holdings: {{holdings}}

PERFORMANCE ATTRIBUTION:

1. TOTAL RETURN DECOMPOSITION
   - Portfolio return
   - Benchmark return
   - Active return (alpha)

2. BRINSON ATTRIBUTION
   - Allocation effect
   - Selection effect
   - Interaction effect

3. FACTOR ATTRIBUTION
   - Market factor
   - Size factor
   - Value factor
   - Momentum factor
   - Quality factor

4. POSITION ATTRIBUTION
   - Top contributors
   - Top detractors
   - Unexpected outcomes

5. RISK-ADJUSTED METRICS
   - Sharpe ratio
   - Information ratio
   - Sortino ratio
   - Maximum drawdown

Provide detailed attribution breakdown.
```

**Variables:** `["portfolio_returns", "benchmark", "holdings"]`

---

### 13. Portfolio Construction

**Name:** `portfolio_construction`

**Subcategory:** construction

**Description:** Constructs optimal portfolio based on investment objectives

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a portfolio manager constructing an investment portfolio.

Investment Objectives:
- Risk tolerance: {{risk_tolerance}}
- Return target: {{return_target}}
- Time horizon: {{time_horizon}}
- Constraints: {{constraints}}

Available positions: {{positions}}

PORTFOLIO CONSTRUCTION:

1. ASSET ALLOCATION
   - Strategic allocation by asset class
   - Sector allocation
   - Geographic allocation
   - Factor exposures

2. POSITION SIZING
   - Individual position weights
   - Concentration limits
   - Liquidity considerations
   - Correlation analysis

3. RISK BUDGETING
   - Risk contribution by position
   - Diversification benefit
   - Tail risk assessment
   - Drawdown expectations

4. OPTIMIZATION
   - Mean-variance optimization
   - Risk parity considerations
   - Constraints application
   - Rebalancing triggers

Provide specific position weights and rationale.
```

**Variables:** `["risk_tolerance", "return_target", "time_horizon", "constraints", "positions"]`

---

### 14. Position Sizer

**Name:** `position_sizer`

**Subcategory:** sizing

**Description:** Determines optimal position sizes based on conviction and risk

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a portfolio manager determining position sizes.

Investment Opportunity: {{opportunity}}
Portfolio Context: {{portfolio}}
Risk Parameters: {{risk_params}}

Determine:
1. Conviction level (1-10)
2. Risk/reward ratio
3. Correlation with existing holdings
4. Liquidity constraints
5. Optimal position size
6. Scaling strategy (entry/exit)

Provide position sizing recommendation with rationale.
```

**Variables:** `{'opportunity': 'json', 'portfolio': 'json', 'risk_params': 'json'}`

---

### 15. Position Sizing

**Name:** `position_sizing`

**Subcategory:** risk

**Description:** Determines optimal position size based on conviction and risk

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are a risk manager determining position sizes.

Position: {{ticker}}
Conviction level: {{conviction}}
Portfolio context: {{portfolio}}

POSITION SIZING ANALYSIS:

1. CONVICTION ASSESSMENT
   - Thesis strength
   - Information edge
   - Catalyst clarity
   - Risk/reward profile

2. RISK METRICS
   - Position volatility
   - Beta to portfolio
   - Correlation with holdings
   - Tail risk

3. SIZING FRAMEWORKS
   - Kelly criterion
   - Risk parity
   - Equal weight baseline
   - Conviction-weighted

4. CONSTRAINTS
   - Liquidity limits
   - Concentration limits
   - Sector limits
   - Regulatory limits

5. RECOMMENDATION
   - Optimal position size
   - Entry strategy
   - Scaling approach

Provide specific position size with justification.
```

**Variables:** `["ticker", "conviction", "portfolio"]`

---

### 16. Rebalancing Analysis

**Name:** `rebalancing_analysis`

**Subcategory:** execution

**Description:** Analyzes portfolio for rebalancing needs

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are a portfolio manager analyzing rebalancing needs.

Current Portfolio: {{current_portfolio}}
Target Allocation: {{target_allocation}}

REBALANCING ANALYSIS:

1. DRIFT ANALYSIS
   - Current vs target weights
   - Drift by position
   - Drift by sector/factor
   - Threshold breaches

2. REBALANCING TRADES
   - Required trades
   - Trade sizes
   - Priority ranking
   - Execution timeline

3. COST ANALYSIS
   - Transaction costs
   - Tax implications
   - Market impact
   - Opportunity cost of not rebalancing

4. OPTIMIZATION
   - Tax-loss harvesting opportunities
   - Wash sale considerations
   - Lot selection

5. RECOMMENDATION
   - Rebalance now vs wait
   - Partial vs full rebalance
   - Execution strategy

Provide specific trade recommendations.
```

**Variables:** `["current_portfolio", "target_allocation"]`

---

### 17. Risk Monitoring

**Name:** `risk_monitoring`

**Subcategory:** risk

**Description:** Monitors portfolio risk metrics and alerts

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
You are a risk manager monitoring portfolio risk.

Portfolio: {{portfolio}}
Risk Limits: {{risk_limits}}

RISK MONITORING:

1. RISK METRICS
   - Portfolio VaR (95%, 99%)
   - Expected shortfall
   - Beta to benchmark
   - Tracking error

2. CONCENTRATION RISK
   - Position concentration
   - Sector concentration
   - Factor concentration
   - Geographic concentration

3. STRESS TESTING
   - Historical scenarios
   - Hypothetical scenarios
   - Correlation stress
   - Liquidity stress

4. LIMIT MONITORING
   - Current vs limits
   - Breach alerts
   - Trend analysis
   - Early warning indicators

5. RECOMMENDATIONS
   - Risk reduction trades
   - Hedging opportunities
   - Limit adjustments

Provide risk dashboard with alerts.
```

**Variables:** `["portfolio", "risk_limits"]`

---

### 18. Scenario Analysis

**Name:** `scenario_analysis`

**Subcategory:** risk

**Description:** Analyzes portfolio performance under various scenarios

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
You are a scenario analyst stress testing portfolios.

Portfolio: {{portfolio}}
Scenarios: {{scenarios}}

SCENARIO ANALYSIS:

1. SCENARIO DEFINITIONS
   - Macro scenarios
   - Market scenarios
   - Sector scenarios
   - Idiosyncratic scenarios

2. IMPACT ANALYSIS
   - Portfolio P&L by scenario
   - Position-level impacts
   - Factor exposures under stress

3. HISTORICAL SCENARIOS
   - 2008 Financial Crisis
   - 2020 COVID Crash
   - 2022 Rate Shock
   - Sector-specific events

4. HYPOTHETICAL SCENARIOS
   - Recession
   - Inflation spike
   - Geopolitical crisis
   - Technology disruption

5. RISK MITIGATION
   - Hedging strategies
   - Position adjustments
   - Tail risk protection

Provide scenario impact analysis.
```

**Variables:** `["portfolio", "scenarios"]`

---

### 19. Sector Rotation Analysis

**Name:** `sector_rotation_analysis`

**Subcategory:** strategy

**Description:** Analyzes sector rotation opportunities

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Analyze sector rotation opportunities based on: {{market_conditions}}

Evaluate sector momentum, valuations, and economic sensitivity.
```

**Variables:** `["market_conditions"]`

---

### 20. Tax Loss Harvesting

**Name:** `tax_loss_harvesting`

**Subcategory:** tax

**Description:** Identifies tax-loss harvesting opportunities

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
You are a tax-aware portfolio manager.

Portfolio: {{portfolio}}
Tax Situation: {{tax_situation}}

TAX-LOSS HARVESTING ANALYSIS:

1. LOSS IDENTIFICATION
   - Positions with unrealized losses
   - Short-term vs long-term
   - Loss amounts
   - Cost basis by lot

2. HARVESTING OPPORTUNITIES
   - Harvestable losses
   - Tax benefit calculation
   - Wash sale considerations
   - Replacement securities

3. STRATEGY
   - Prioritization of harvests
   - Timing considerations
   - Year-end planning
   - Carry-forward analysis

4. IMPLEMENTATION
   - Specific trades
   - Replacement positions
   - Holding period management

5. PROJECTED BENEFIT
   - Tax savings
   - After-tax return impact
   - Multi-year planning

Provide specific harvesting recommendations.
```

**Variables:** `["portfolio", "tax_situation"]`

---

### 21. Transition Management

**Name:** `transition_management`

**Subcategory:** execution

**Description:** Plans portfolio transition strategy

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 4000)

**Template:**

```
Plan transition from {{current_portfolio}} to {{target_portfolio}}

Optimize for: Minimizing costs, tax efficiency, market impact.
```

**Variables:** `["current_portfolio", "target_portfolio"]`

---

## Research Synthesis

### 1. Bull Bear Case Generator

**Name:** `bull_bear_case_generator`

**Subcategory:** scenario

**Description:** Generates bull and bear cases for investment

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are an analyst generating bull/bear scenarios.

Company: {{ticker}}
Base Case: {{base_case}}

Generate:
1. Bull case scenario
   - Key assumptions
   - Probability
   - Price target
2. Bear case scenario
   - Key assumptions
   - Probability
   - Price target
3. Key swing factors
4. Monitoring triggers

Provide probability-weighted expected value.
```

**Variables:** `{'ticker': 'string', 'base_case': 'json'}`

---

### 2. Earnings Preview Generator

**Name:** `earnings_preview_generator`

**Subcategory:** earnings

**Description:** Generates earnings preview reports

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are an analyst preparing an earnings preview.

Company: {{ticker}}
Consensus Estimates: {{estimates}}
Historical Data: {{historical}}

Generate preview covering:
1. Key metrics to watch
2. Consensus expectations
3. Whisper numbers
4. Key questions for management
5. Potential surprises
6. Stock reaction scenarios

Provide actionable trading guidance.
```

**Variables:** `{'ticker': 'string', 'estimates': 'json', 'historical': 'json'}`

---

## Special Situations

### 1. Activist Situation Analyzer

**Name:** `activist_situation_analyzer`

**Subcategory:** activism

**Description:** Analyzes activist investor situations

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are analyzing an activist situation.

Target: {{ticker}}
Activist: {{activist}}
13D Filing: {{filing_data}}

Analyze:
1. Activist track record
2. Campaign objectives
3. Board/management response
4. Likely outcomes
5. Timeline expectations
6. Value creation potential

Provide investment recommendation.
```

**Variables:** `{'ticker': 'string', 'activist': 'string', 'filing_data': 'json'}`

---

### 2. Ipo Analysis

**Name:** `ipo_analysis`

**Subcategory:** ipo

**Description:** Analyzes IPO investment opportunities

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are an IPO analyst evaluating a new issue.

Company: {{company}}
S-1 Data: {{s1_data}}
Comparables: {{comps}}

Analyze:
1. Business model and moat
2. Growth trajectory
3. Profitability path
4. Valuation vs. comps
5. Use of proceeds
6. Lock-up dynamics

Provide IPO investment recommendation.
```

**Variables:** `{'company': 'string', 's1_data': 'json', 'comps': 'json'}`

---

### 3. Spinoff Opportunity Analyzer

**Name:** `spinoff_opportunity_analyzer`

**Subcategory:** corporate_actions

**Description:** Analyzes spinoff investment opportunities

**LLM:** N/A / N/A (temp: N/A, max_tokens: N/A)

**Template:**

```
You are a special situations analyst evaluating spinoffs.

Parent Company: {{parent_ticker}}
Spinoff Details: {{spinoff_details}}

Analyze:
1. Strategic rationale for separation
2. Standalone valuation of spinoff
3. Forced selling dynamics
4. Index inclusion/exclusion impact
5. Management incentive alignment
6. Hidden value unlocking potential

Provide investment recommendation for both parent and spinoff.
```

**Variables:** `{'parent_ticker': 'string', 'spinoff_details': 'json'}`

---

## Thesis

### 1. Contrarian Thesis Development

**Name:** `contrarian_thesis_development`

**Subcategory:** strategy

**Description:** Develops contrarian investment thesis

**LLM:** openai / gpt-4 (temp: 0.4, max_tokens: 4000)

**Template:**

```
Develop contrarian thesis for: {{ticker}}

Current sentiment: {{sentiment}}

Analyze:
1. Why is sentiment so negative/positive?
2. What is the market missing?
3. What would change sentiment?
4. Historical precedents
5. Risk/reward of contrarian bet
```

**Variables:** `["ticker", "sentiment"]`

---

### 2. Exit Strategy

**Name:** `exit_strategy`

**Subcategory:** execution

**Description:** Develops exit strategy for position

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Develop exit strategy for: {{ticker}}

Current position: {{position}}
Thesis: {{thesis}}

Define:
1. Target price exit
2. Stop-loss levels
3. Time-based exit
4. Thesis invalidation exit
5. Scaling strategy
```

**Variables:** `["ticker", "position", "thesis"]`

---

### 3. Investment Memo

**Name:** `investment_memo`

**Subcategory:** output

**Description:** Creates formal investment memorandum

**LLM:** anthropic / claude-3-opus (temp: 0.3, max_tokens: 6000)

**Template:**

```
Create an investment memorandum for: {{ticker}}

Research: {{research}}

Include: Executive summary, business overview, investment thesis, financial analysis, valuation, risks, recommendation.

Format for investment committee presentation.
```

**Variables:** `["ticker", "research"]`

---

### 4. Investment Thesis Synthesis

**Name:** `investment_thesis_synthesis`

**Subcategory:** synthesis

**Description:** Synthesizes research into coherent investment thesis

**LLM:** anthropic / claude-3-opus (temp: 0.3, max_tokens: 5000)

**Template:**

```
Synthesize an investment thesis for: {{ticker}}

Based on research: {{research_summary}}

Structure:
1. One-sentence thesis
2. Key thesis points (3-5)
3. Supporting evidence
4. Key assumptions
5. What could go wrong
6. Catalysts and timeline
7. Valuation and target price

Write in assertive, sell-side style.
```

**Variables:** `["ticker", "research_summary"]`

---

### 5. Peer Thesis Comparison

**Name:** `peer_thesis_comparison`

**Subcategory:** analysis

**Description:** Compares investment thesis across peer group

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 4000)

**Template:**

```
Compare investment thesis for peer group: {{peers}}

For each company:
1. Investment thesis summary
2. Key differentiators
3. Relative valuation
4. Risk/reward ranking

Recommend best idea in the group.
```

**Variables:** `["peers"]`

---

### 6. Pre Mortem Analysis

**Name:** `pre_mortem_analysis`

**Subcategory:** risk

**Description:** Conducts pre-mortem on investment thesis

**LLM:** openai / gpt-4 (temp: 0.4, max_tokens: 4000)

**Template:**

```
Conduct pre-mortem analysis for investment in: {{ticker}}

Thesis: {{thesis}}

Imagine the investment failed. Analyze:
1. What went wrong?
2. What did we miss?
3. What assumptions were wrong?
4. What external factors hurt us?
5. How could we have known?

Provide probability-weighted risk assessment.
```

**Variables:** `["ticker", "thesis"]`

---

### 7. Thesis Monitoring Framework

**Name:** `thesis_monitoring_framework`

**Subcategory:** monitoring

**Description:** Creates framework for monitoring investment thesis

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Create monitoring framework for thesis: {{thesis}}

Company: {{ticker}}

Define:
1. Key performance indicators to track
2. Thesis confirmation signals
3. Thesis invalidation triggers
4. Data sources and frequency
5. Review schedule
```

**Variables:** `["thesis", "ticker"]`

---

### 8. Thesis Presentation

**Name:** `thesis_presentation`

**Subcategory:** output

**Description:** Creates thesis presentation for stakeholders

**LLM:** anthropic / claude-3-opus (temp: 0.3, max_tokens: 5000)

**Template:**

```
Create thesis presentation for: {{ticker}}

Audience: {{audience}}
Research: {{research}}

Structure for 10-minute pitch:
1. Hook/headline
2. Company overview
3. Investment thesis
4. Key evidence
5. Valuation
6. Risks and mitigants
7. Recommendation
```

**Variables:** `["ticker", "audience", "research"]`

---

### 9. Thesis Update

**Name:** `thesis_update`

**Subcategory:** monitoring

**Description:** Updates investment thesis based on new information

**LLM:** openai / gpt-4 (temp: 0.2, max_tokens: 3000)

**Template:**

```
Update investment thesis for: {{ticker}}

Original thesis: {{original_thesis}}
New information: {{new_info}}

Evaluate:
1. Does new info confirm or challenge thesis?
2. What assumptions need updating?
3. How does fair value change?
4. Should position size change?
5. Updated conviction level
```

**Variables:** `["ticker", "original_thesis", "new_info"]`

---

### 10. Variant Perception

**Name:** `variant_perception`

**Subcategory:** edge

**Description:** Identifies variant perception vs consensus

**LLM:** openai / gpt-4 (temp: 0.3, max_tokens: 3000)

**Template:**

```
Identify variant perception for: {{ticker}}

Consensus view: {{consensus}}

Analyze:
1. Where does our view differ from consensus?
2. Why might we be right?
3. What does the market not understand?
4. What would prove us right/wrong?
5. Time horizon for thesis to play out
```

**Variables:** `["ticker", "consensus"]`

---

