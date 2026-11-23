export class AgentRuntimeError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = "RUNTIME_ERROR", details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AgentRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", details);
  }
}

export class InvalidStateTransitionError extends AgentRuntimeError {
  constructor(fromState: string, toState: string, reason?: string) {
    super(
      `Invalid state transition from '${fromState}' to '${toState}'${reason ? `: ${reason}` : "."}`,
      "INVALID_STATE_TRANSITION",
      { fromState, toState, reason }
    );
  }
}

export class ToolPermissionError extends AgentRuntimeError {
  constructor(toolName: string, permission: string, reason?: string) {
    super(
      `Tool '${toolName}' execution denied with permission '${permission}'${reason ? `: ${reason}` : "."}`,
      "TOOL_PERMISSION_DENIED",
      { toolName, permission, reason }
    );
  }
}

export class ToolNotFoundError extends AgentRuntimeError {
  constructor(toolName: string) {
    super(`Tool not found: '${toolName}'`, "TOOL_NOT_FOUND", { toolName });
  }
}

export class ToolExecutionError extends AgentRuntimeError {
  public readonly isRetryable: boolean;

  constructor(toolName: string, message: string, isRetryable = false, details?: unknown) {
    super(`Tool '${toolName}' failed: ${message}`, "TOOL_EXECUTION_ERROR", details);
    this.isRetryable = isRetryable;
  }
}

export class BudgetExceededError extends AgentRuntimeError {
  constructor(resource: string, limit: number, actual: number) {
    super(
      `Execution budget exceeded for ${resource}: limit was ${limit}, received ${actual}`,
      "BUDGET_EXCEEDED",
      { resource, limit, actual }
    );
  }
}

export class TimeoutError extends AgentRuntimeError {
  constructor(target: string, timeoutMs: number) {
    super(`Operation '${target}' timed out after ${timeoutMs}ms`, "TIMEOUT", { target, timeoutMs });
  }
}

export class NotFoundError extends AgentRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, "NOT_FOUND", details);
  }
}

export class UnauthorizedError extends AgentRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, "UNAUTHORIZED", details);
  }
}

export class CancellationError extends AgentRuntimeError {
  constructor(target = "Task", reason = "Cancelled by user or system signal") {
    super(`${target} was cancelled: ${reason}`, "CANCELLED", { target, reason });
  }
}

export class ProviderError extends AgentRuntimeError {
  constructor(provider: string, message: string, details?: unknown) {
    super(`Model provider '${provider}' error: ${message}`, "PROVIDER_ERROR", details);
  }
}

export class ProviderConfigurationError extends AgentRuntimeError {
  constructor(provider: string, message: string) {
    super(`Model provider '${provider}' is not configured: ${message}`, "PROVIDER_NOT_CONFIGURED");
  }
}

export class ReportValidationError extends AgentRuntimeError {
  public readonly validationErrors: string[];

  constructor(validationErrors: string[]) {
    super(`Research report validation failed: ${validationErrors.join("; ")}`, "REPORT_VALIDATION_FAILED", {
      validationErrors,
    });
    this.validationErrors = validationErrors;
  }
}

export class DatabaseError extends AgentRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, "DATABASE_ERROR", details);
  }
}

