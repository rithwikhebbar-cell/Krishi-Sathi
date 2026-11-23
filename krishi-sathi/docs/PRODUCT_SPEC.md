# Product Specification — Krishi Sathi

## Purpose
Help users investigate agricultural questions using a bounded research workflow that retrieves evidence, evaluates it and produces transparent reports.

## Initial user journey
1. User submits a research question and optional region/farm context.
2. API validates the request and creates a task.
3. Planner produces a limited plan.
4. Runtime invokes registered read-only tools.
5. Evidence is normalized, deduplicated and assessed.
6. Model synthesizes a report grounded in retrieved evidence.
7. Validator checks structure and source references.
8. User receives findings, citations, uncertainty and limitations.

## In scope for first release
- Authenticated research-task creation and status retrieval.
- Bounded planning and tool execution.
- Trusted web/internal knowledge retrieval adapters.
- Evidence provenance and source metadata.
- Citation-aware synthesis and validation.
- Persistence, observability, retries and recovery.
- Human-readable report with limitations.

## Out of scope initially
- Autonomous farm operations or equipment control.
- Purchasing, spraying, irrigation changes or financial transactions.
- Arbitrary shell/code execution.
- Autonomous modification of farm records.
- Unreviewed high-impact recommendations.

## Report contract
A report contains: question, concise answer, findings, evidence references, assumptions, uncertainty, limitations, generated timestamp and recommended next research questions. Advice must distinguish sourced facts from inference.

## Quality attributes
Security, traceability, reproducibility, bounded cost/latency, graceful failure, testability and compatibility with existing deterministic agricultural engines.
