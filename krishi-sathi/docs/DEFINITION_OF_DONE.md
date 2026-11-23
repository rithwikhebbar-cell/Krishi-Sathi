# Definition of Done

A milestone is complete only when:
- Acceptance criteria are implemented and reviewed.
- Type-check and relevant automated tests pass.
- Failure paths and permission boundaries are tested.
- No secrets are exposed to client bundles or logs.
- Evidence-backed claims have resolvable source references.
- Existing agricultural functionality passes regression tests.
- Documentation and environment examples are updated.

## First runtime release gate
- Authenticated task creation.
- Bounded plan and execution.
- At least two registered read-only tools.
- Evidence provenance retained.
- Citation validation passes.
- Timeouts and bounded retries work.
- Task state survives restart.
- RLS/ownership isolation verified.
- Existing regression suite green.
