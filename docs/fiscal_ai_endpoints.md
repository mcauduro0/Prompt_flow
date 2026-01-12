# Fiscal AI API Endpoints

Base URL: `https://api.fiscal.ai`

## Authentication
- API Key via query parameter: `?apiKey=YOUR_KEY`
- Or via header: `X-Api-Key: YOUR_KEY`

## Company Identification
Use either:
- `ticker` + `exchange` (e.g., ticker=AAPL&exchange=NASDAQ)
- `companyKey` (e.g., companyKey=NASDAQ_AAPL)
- `cik` (SEC Central Index Key)
- `cusip` or `isin` (requires license)

## Available Endpoints

### 1. Companies List
```
GET /v2/companies-list
```
Parameters: pageNumber, pageSize (max 1000)

### 2. Company Profile
```
GET /v2/company/profile
```
Returns: name, ticker, exchange, sector, industry, availableDatasets, description

### 3. Income Statement (As Reported)
```
GET /v1/company/financials/income-statement/as-reported
```
Parameters: periodType (annual, quarterly, semi-annual, ltm, ytd, latest), currency

### 4. Balance Sheet (As Reported)
```
GET /v1/company/financials/balance-sheet/as-reported
```
Parameters: periodType, currency

### 5. Cash Flow Statement (As Reported)
```
GET /v1/company/financials/cash-flow-statement/as-reported
```
Parameters: periodType, currency

## Key Features
- Raw financial data exactly as disclosed by company
- Source document links for traceability
- Currency conversion support
- Historical data with restated flag
