import { InvalidStateTransitionError } from "../contracts/errors";
import { TaskStatus } from "../contracts/types";

export const VALID_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  CREATED: ["VALIDATING", "FAILED", "CANCELLED"],
  VALIDATING: ["PLANNING", "FAILED", "CANCELLED"],
  PLANNING: ["EXECUTING", "FAILED", "CANCELLED", "TIMED_OUT"],
  EXECUTING: ["EVALUATING", "FAILED", "CANCELLED", "TIMED_OUT"],
  EVALUATING: ["SYNTHESIZING", "PLANNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  SYNTHESIZING: ["VALIDATING_REPORT", "FAILED", "CANCELLED", "TIMED_OUT"],
  VALIDATING_REPORT: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: [],
};

export const TERMINAL_STATES: readonly TaskStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
];

export class TaskStateMachine {
  private currentState: TaskStatus;
  private readonly history: Array<{ state: TaskStatus; timestamp: string; reason?: string }>;

  constructor(initialState: TaskStatus = "CREATED") {
    this.currentState = initialState;
    this.history = [{ state: initialState, timestamp: new Date().toISOString() }];
  }

  getState(): TaskStatus {
    return this.currentState;
  }

  isTerminal(): boolean {
    return TERMINAL_STATES.includes(this.currentState);
  }

  canTransitionTo(nextState: TaskStatus): boolean {
    const allowed = VALID_TRANSITIONS[this.currentState];
    return allowed ? allowed.includes(nextState) : false;
  }

  transitionTo(nextState: TaskStatus, reason?: string): TaskStatus {
    if (this.currentState === nextState) {
      return this.currentState;
    }

    if (!this.canTransitionTo(nextState)) {
      throw new InvalidStateTransitionError(
        this.currentState,
        nextState,
        this.isTerminal()
          ? `Task is already in terminal state '${this.currentState}'.`
          : reason
      );
    }

    this.currentState = nextState;
    this.history.push({
      state: nextState,
      timestamp: new Date().toISOString(),
      reason,
    });

    return this.currentState;
  }

  getHistory(): ReadonlyArray<{ state: TaskStatus; timestamp: string; reason?: string }> {
    return [...this.history];
  }
}
