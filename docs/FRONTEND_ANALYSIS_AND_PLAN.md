# ARC Investment Factory - Frontend Analysis & Development Plan

**Date:** January 13, 2026
**Author:** Manus AI

## 1. Executive Summary

This document provides a comprehensive analysis of the current ARC frontend in light of the significant backend upgrades, including the implementation of 116 state-of-the-art prompts, multi-LLM routing, and enhanced data provider integration. 

While the existing frontend provides a solid foundation for core workflows (Inbox, Research), it now lags behind the backend's capabilities. Key gaps exist in **visibility, control, and management** of the expanded system. 

This plan proposes a two-phased approach to bridge these gaps:

1.  **Phase 1 (Critical Enhancements):** Focus on immediate, high-impact improvements to existing pages (`Telemetry`, `Inbox`, `Research`) to expose new metrics and data.
2.  **Phase 2 (New Modules):** Develop three new, dedicated tabs to manage the expanded capabilities: **`Prompt Manager`**, **`Portfolio Hub`**, and **`System Status & Runs`**.

This initiative will transform the frontend from a simple workflow tool into a comprehensive **Investment Command Center**, providing full transparency and control over the entire ARC pipeline.

## 2. Current Frontend Structure

The existing frontend is a Next.js application with the following key pages:

| Page | Path | Purpose | Status |
|---|---|---|---|
| **Status** | `/status` | Shows system warm-up status. | ✅ Functional |
| **Inbox** | `/inbox` | Triage new investment ideas from Lane A. | ✅ Functional (but needs more data) |
| **Queue** | `/queue` | Shows items currently being processed. | ✅ Functional |
| **Research** | `/research` | Displays completed Lane B research packets. | ✅ Functional (but needs more data) |
| **QA** | `/qa` | Shows QA reports (currently placeholder). | ⚠️ Placeholder |
| **Memory** | `/memory` | Searchable knowledge base (currently placeholder). | ⚠️ Placeholder |
| **Telemetry** | `/telemetry` | Displays operational metrics. | ✅ Functional (but needs more data) |
| **Settings** | `/settings` | User and system settings. | ✅ Functional |

## 3. Gap Analysis: Frontend vs. Backend

The backend has evolved significantly, creating a disconnect with the frontend's capabilities. The following table outlines the major gaps identified.

| Backend Capability | Frontend Gap | Impact |
|---|---|---|
| **116 Unique Prompts** | No central place to view, manage, or edit prompts. | **High:** Lack of visibility and control over the core logic of the system. |
| **Multi-LLM Routing** | Telemetry does not break down costs/latency by model (GPT-5.2, Gemini, Claude). | **Medium:** Incomplete cost and performance analysis. |
| **Institutional Metrics** | `expected_value_score`, `value_cost_ratio`, `status_institucional` are not displayed. | **High:** Critical decision-making data is not visible to the user. |
| **Portfolio Lane (21 prompts)** | No dedicated UI to manage portfolio construction, risk, or performance. | **High:** An entire lane of functionality is inaccessible. |
| **Monitoring Lane (2 prompts)** | No UI to view real-time monitoring alerts or sentiment. | **Medium:** Monitoring happens in the backend but is not surfaced. |
| **Run History & Logs** | `/runs` page is basic; no detailed logs or error inspection. | **Medium:** Difficult to debug failed runs or track specific executions. |
| **Data Provider Status** | No UI to check the status of Polygon, FMP, FRED, etc. | **Low:** Status is checked via scripts, but not visible in the UI. |

## 4. Proposed Development Plan

To address these gaps, the following two-phased plan is proposed.

### Phase 1: Critical Enhancements (Estimated: 1-2 days)

These are high-priority improvements to existing pages.

#### 4.1. Telemetry Page v2

-   **Objective:** Provide a complete, multi-dimensional view of system performance.
-   **Changes:**
    1.  **Breakdown by LLM:** Add charts to show token usage, cost, and latency for GPT-5.2, Gemini, and Claude.
    2.  **Display Institutional Metrics:** Add a table showing the top 10 prompts by `value_cost_ratio`.
    3.  **Lane Outcome Funnel:** Visualize the flow of ideas from Lane A to Lane B, including gate pass rates.

#### 4.2. Inbox & Research Cards v2

-   **Objective:** Surface critical decision-making data during triage and review.
-   **Changes:**
    1.  **Inbox Card:** Add `expected_value_score` and `value_cost_ratio` to each idea card.
    2.  **Research Packet:** Display the full list of prompts executed in Lane B, with their individual costs and tokens.
    3.  **Download Memo:** Implement the functionality to download the final investment memo as a PDF or Markdown file.

### Phase 2: New Modules (Estimated: 4-5 days)

These are new, dedicated pages to manage the expanded system.

#### 4.3. New Tab: `Prompt Manager`

-   **Objective:** Create a central hub for viewing, managing, and editing all 116 prompts.
-   **Features:**
    1.  **Master Table:** A searchable, sortable table of all prompts with columns for `id`, `lane`, `stage`, `model`, `status_institucional`, and `value_cost_ratio`.
    2.  **Prompt Detail View:** A read-only view showing the full `system_prompt` and `user_prompt_template`.
    3.  **(Optional) Prompt Editor:** A future feature to allow direct editing and versioning of prompts from the UI.

#### 4.4. New Tab: `Portfolio Hub`

-   **Objective:** Build a dedicated interface for the Portfolio lane.
-   **Features:**
    1.  **Portfolio Construction:** An interface to trigger portfolio construction prompts with specific inputs (e.g., risk tolerance, target sectors).
    2.  **Risk Dashboard:** Display outputs from portfolio risk prompts (`correlation_analysis`, `drawdown_analysis`).
    3.  **Performance Attribution:** Show results from `portfolio_performance_reporter`.

#### 4.5. New Tab: `System & Runs`

-   **Objective:** Consolidate system status and provide detailed run history.
-   **Features:**
    1.  **Data Provider Status:** A dashboard showing the real-time status of Polygon, FMP, FRED, etc.
    2.  **Run History:** A detailed, searchable log of all Lane A and Lane B runs.
    3.  **Run Detail View:** Click a run to see the full execution log, including every prompt called, its inputs, output, and any errors.

## 5. Conclusion & Recommendation

The backend of the ARC Investment Factory is now a state-of-the-art system. The proposed frontend enhancements are critical to unlocking its full potential and providing the necessary visibility and control for a production environment.

It is recommended to proceed with **Phase 1 immediately** to deliver quick, high-value improvements, followed by the systematic development of the new modules in **Phase 2**.
