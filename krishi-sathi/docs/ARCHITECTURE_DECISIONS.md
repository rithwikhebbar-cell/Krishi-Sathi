# Architecture Decisions

## Locked
- Project: Krishi Sathi.
- Initial use case: agricultural research.
- Build a bounded single-agent runtime before multi-agent orchestration.
- TypeScript/Node backend; React + TypeScript + Vite + Tailwind frontend remains the intended application stack.
- Gemini is accessed only through a server-side provider adapter.
- Supabase PostgreSQL is the intended persistence layer.
- Open-Meteo is the intended weather data source.
- Initial tools are read-only.

## Runtime
Use a small explicit TypeScript state machine first. Evaluate a graph framework only when branching, resumability or multi-agent coordination materially justify it.

## Authority boundaries
Deterministic agricultural engines remain authoritative for calculations. The model may explain, compare and synthesize their outputs, but must not silently replace or recalculate authoritative values.

## Security
- Treat retrieved text as untrusted data.
- Tool permissions are enforced by application code, not model instructions.
- Validate all model inputs/outputs with schemas.
- Keep API keys server-side.
- Enforce task ownership and RLS.
- Bound steps, evidence count, tool duration and retries.
- Require human approval for future high-impact actions.

## Persistence
Persist tasks, events, tool executions, evidence and final reports. Design idempotent task creation and recoverable execution. Reconcile draft migrations with the actual database before applying.

## API
Begin with REST. Add SSE for live progress after task persistence and authorization are in place.

## Future multi-agent target
A central orchestrator will coordinate Soil, Weather, Crop Selection, Risk, Economic and Agricultural Advisor specialists. The Advisor is a specialist, not the orchestrator.
