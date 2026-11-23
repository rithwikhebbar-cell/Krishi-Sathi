import { describe, expect, it } from "vitest";
import { TaskStateMachine, VALID_TRANSITIONS, TERMINAL_STATES } from "../../src/agentic/runtime/stateMachine";
import { InvalidStateTransitionError } from "../../src/agentic/contracts/errors";
import { TaskStatus } from "../../src/agentic/contracts/types";

describe("TaskStateMachine", () => {
  it("initializes with CREATED status by default", () => {
    const sm = new TaskStateMachine();
    expect(sm.getState()).toBe("CREATED");
    expect(sm.isTerminal()).toBe(false);
  });

  it("follows a standard happy-path transition lifecycle", () => {
    const sm = new TaskStateMachine("CREATED");

    expect(sm.transitionTo("VALIDATING")).toBe("VALIDATING");
    expect(sm.transitionTo("PLANNING")).toBe("PLANNING");
    expect(sm.transitionTo("EXECUTING")).toBe("EXECUTING");
    expect(sm.transitionTo("EVALUATING")).toBe("EVALUATING");
    expect(sm.transitionTo("SYNTHESIZING")).toBe("SYNTHESIZING");
    expect(sm.transitionTo("VALIDATING_REPORT")).toBe("VALIDATING_REPORT");
    expect(sm.transitionTo("COMPLETED")).toBe("COMPLETED");

    expect(sm.getState()).toBe("COMPLETED");
    expect(sm.isTerminal()).toBe(true);
  });

  it("allows re-planning from EVALUATING", () => {
    const sm = new TaskStateMachine("EVALUATING");
    expect(sm.canTransitionTo("PLANNING")).toBe(true);
    expect(sm.transitionTo("PLANNING")).toBe("PLANNING");
  });

  it("rejects invalid state jumps", () => {
    const sm = new TaskStateMachine("CREATED");
    expect(() => sm.transitionTo("EXECUTING")).toThrow(InvalidStateTransitionError);
    expect(() => sm.transitionTo("COMPLETED")).toThrow(InvalidStateTransitionError);
    expect(() => sm.transitionTo("SYNTHESIZING")).toThrow(InvalidStateTransitionError);
  });

  it("rejects any transitions out of terminal states", () => {
    for (const term of TERMINAL_STATES) {
      const sm = new TaskStateMachine(term);
      expect(sm.isTerminal()).toBe(true);

      const allStates: TaskStatus[] = [
        "CREATED", "VALIDATING", "PLANNING", "EXECUTING", "EVALUATING",
        "SYNTHESIZING", "VALIDATING_REPORT", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"
      ];

      for (const target of allStates) {
        if (target !== term) {
          expect(() => sm.transitionTo(target)).toThrow(InvalidStateTransitionError);
        }
      }
    }
  });

  it("maintains an audit history of state transitions", () => {
    const sm = new TaskStateMachine("CREATED");
    sm.transitionTo("VALIDATING", "Validating task input");
    sm.transitionTo("PLANNING", "Formulating research plan");

    const history = sm.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].state).toBe("CREATED");
    expect(history[1].state).toBe("VALIDATING");
    expect(history[1].reason).toBe("Validating task input");
    expect(history[2].state).toBe("PLANNING");
    expect(history[2].reason).toBe("Formulating research plan");
  });

  it("treats transition to identical current state as idempotent no-op", () => {
    const sm = new TaskStateMachine("PLANNING");
    expect(sm.transitionTo("PLANNING")).toBe("PLANNING");
  });
});
