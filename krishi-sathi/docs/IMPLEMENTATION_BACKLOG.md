# Implementation Backlog

## M0 — Specification (locked)
- [x] Product identity and initial use case.
- [x] Single-agent-first strategy.
- [x] Initial architecture and safety boundaries.
- [ ] Audit current application and database before integration.

## M1 — Runtime foundation
- [ ] Audit repository and establish build/test baseline.
- [ ] Finalize task, plan, tool, evidence and report schemas.
- [ ] Implement runtime state machine and cancellation.
- [ ] Implement Gemini adapter with structured output.
- [ ] Add registered tool execution and permission checks.
- [ ] Add timeouts, retry policy, idempotency and budgets.
- [ ] Add unit, integration and adversarial tests.

## M2 — Research retrieval
- [ ] Trusted search provider adapter.
- [ ] Internal agricultural knowledge retrieval.
- [ ] Evidence normalization and deduplication.
- [ ] Provenance, freshness and source-quality scoring.
- [ ] Prompt-injection and malicious-document tests.

## M3 — Research intelligence
- [ ] Bounded research planner.
- [ ] Evidence-grounded synthesis.
- [ ] Claim-to-source validation.
- [ ] Report schema and safety validation.
- [ ] Uncertainty and limitations reporting.

## M4 — Persistence and API
- [ ] Supabase repositories and migrations after schema/RLS audit.
- [ ] Authenticated task create/status/report endpoints.
- [ ] Task event persistence and recovery.
- [ ] Idempotency and cancellation.
- [ ] SSE progress updates.

## M5 — User interface
- [ ] Research task form.
- [ ] Execution timeline.
- [ ] Report viewer and source panel.
- [ ] Failure/retry and cancellation states.

## M6 — Multi-agent evolution
- [ ] Define specialist contracts.
- [ ] Integrate Soil, Weather, Crop Selection, Risk, Economic and Advisor agents.
- [ ] Add central orchestrator and cross-agent evidence handling.

## M7 — Production hardening
- [ ] Threat model and security review.
- [ ] Rate limits, quotas and cost controls.
- [ ] Structured logs, metrics and traces.
- [ ] CI/CD, backups and recovery drills.
- [ ] Regression suite and release gates.
