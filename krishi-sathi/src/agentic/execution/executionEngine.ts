import { randomUUID } from "crypto";
import {
  ResearchPlan,
  ResearchStep,
  RuntimeLimits,
  ToolExecution,
  ToolExecutionContext,
} from "../contracts/types";
import {
  BudgetExceededError,
  CancellationError,
  TimeoutError,
  ToolExecutionError,
  ToolNotFoundError,
  ToolPermissionError,
  ValidationError,
} from "../contracts/errors";
import { ToolRegistry } from "../tools/registry";
import { RuntimeEventBus } from "../runtime/eventBus";

export interface ExecutionOptions {
  taskId: string;
  signal?: AbortSignal;
  concurrent?: boolean;
}

export class ExecutionEngine {
  constructor(
    private readonly tools: ToolRegistry,
    private readonly limits: RuntimeLimits,
    private readonly eventBus?: RuntimeEventBus
  ) {}

  /**
   * Executes a research plan with bounds, timeouts, retries, and cancellation.
   */
  async executePlan(
    plan: ResearchPlan,
    options: ExecutionOptions
  ): Promise<ToolExecution[]> {
    const { taskId, signal, concurrent = false } = options;

    if (signal?.aborted) {
      throw new CancellationError("Task execution", "Signal already aborted");
    }

    if (plan.steps.length > this.limits.maxSteps) {
      throw new BudgetExceededError("plan steps", this.limits.maxSteps, plan.steps.length);
    }

    const executions: ToolExecution[] = [];

    if (concurrent && this.limits.maxConcurrentTools > 1) {
      // Chunk steps by maxConcurrentTools
      const chunkSize = Math.min(this.limits.maxConcurrentTools, 2);
      for (let i = 0; i < plan.steps.length; i += chunkSize) {
        if (signal?.aborted) {
          throw new CancellationError("Task execution", "Signal aborted before step batch");
        }
        const batch = plan.steps.slice(i, i + chunkSize);
        const batchResults = await Promise.all(
          batch.map((step) => this.executeStep(taskId, step, signal))
        );
        executions.push(...batchResults);
      }
    } else {
      // Sequential execution (default)
      for (const step of plan.steps) {
        if (signal?.aborted) {
          throw new CancellationError("Task execution", "Signal aborted before step");
        }
        const execution = await this.executeStep(taskId, step, signal);
        executions.push(execution);

        // If step failed permanently with fatal error, stop execution
        if (execution.status === "FAILED") {
          break;
        }
      }
    }

    return executions;
  }

  /**
   * Executes a single research step with timeout, retries, and bounded execution.
   */
  async executeStep(
    taskId: string,
    step: ResearchStep,
    signal?: AbortSignal
  ): Promise<ToolExecution> {
    const executionId = `exec_${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const toolExecution: ToolExecution = {
      id: executionId,
      taskId,
      stepId: step.id,
      toolName: step.toolName,
      input: step.input,
      status: "PENDING",
      attempts: 0,
      durationMs: 0,
      startedAt,
    };

    if (signal?.aborted) {
      toolExecution.status = "CANCELLED";
      toolExecution.durationMs = Date.now() - startTime;
      toolExecution.completedAt = new Date().toISOString();
      toolExecution.error = "Cancelled before execution";
      return toolExecution;
    }

    // 1. Verify tool exists & permission & input schema
    let validatedInvocation: { tool: any; validatedInput: any };
    try {
      validatedInvocation = this.tools.validateInvocation(step.toolName, step.input);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toolExecution.status = "FAILED";
      toolExecution.durationMs = Date.now() - startTime;
      toolExecution.completedAt = new Date().toISOString();
      toolExecution.error = errorMsg;
      toolExecution.attempts = 1;

      this.eventBus?.emit(taskId, "TOOL_FAILED", {
        stepId: step.id,
        toolName: step.toolName,
        error: errorMsg,
        executionId,
      });

      // Permanent failure - rethrow if permission or not found or validation
      if (
        err instanceof ToolPermissionError ||
        err instanceof ToolNotFoundError ||
        err instanceof ValidationError
      ) {
        throw err;
      }

      return toolExecution;
    }

    const { tool, validatedInput } = validatedInvocation;
    const timeoutMs = Math.min(tool.timeoutMs || 10_000, this.limits.toolTimeoutMs);
    const maxRetries = Math.min(
      tool.retryPolicy?.maxRetries ?? 0,
      this.limits.maxRetriesPerTool
    );

    toolExecution.status = "RUNNING";
    this.eventBus?.emit(taskId, "TOOL_STARTED", {
      stepId: step.id,
      toolName: step.toolName,
      executionId,
      timeoutMs,
    });

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      attempt++;
      toolExecution.attempts = attempt;

      if (signal?.aborted) {
        toolExecution.status = "CANCELLED";
        toolExecution.durationMs = Date.now() - startTime;
        toolExecution.completedAt = new Date().toISOString();
        toolExecution.error = "Execution cancelled by signal";
        return toolExecution;
      }

      try {
        const output = await this.executeWithTimeout(
          tool,
          validatedInput,
          { taskId, stepId: step.id, signal },
          timeoutMs,
          signal
        );

        // Validate output schema
        const validatedOutput = this.tools.validateOutput(step.toolName, output);

        toolExecution.status = "COMPLETED";
        toolExecution.output = validatedOutput;
        toolExecution.durationMs = Date.now() - startTime;
        toolExecution.completedAt = new Date().toISOString();

        this.eventBus?.emit(taskId, "TOOL_COMPLETED", {
          stepId: step.id,
          toolName: step.toolName,
          executionId,
          durationMs: toolExecution.durationMs,
        });

        return toolExecution;
      } catch (err: unknown) {
        lastError = err;

        // Determine if retryable
        const isRetryable = this.isRetryableError(err);

        if (attempt <= maxRetries && isRetryable && !signal?.aborted) {
          const backoff = (tool.retryPolicy?.backoffMs ?? 200) * attempt;
          this.eventBus?.emit(taskId, "TOOL_RETRIED", {
            stepId: step.id,
            toolName: step.toolName,
            attempt,
            maxRetries,
            backoffMs: backoff,
            error: err instanceof Error ? err.message : String(err),
          });
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          break;
        }
      }
    }

    // All attempts failed
    const finalErrorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    toolExecution.durationMs = Date.now() - startTime;
    toolExecution.completedAt = new Date().toISOString();
    toolExecution.error = finalErrorMessage;

    if (lastError instanceof TimeoutError) {
      toolExecution.status = "TIMED_OUT";
    } else if (lastError instanceof CancellationError || signal?.aborted) {
      toolExecution.status = "CANCELLED";
    } else {
      toolExecution.status = "FAILED";
    }

    this.eventBus?.emit(taskId, "TOOL_FAILED", {
      stepId: step.id,
      toolName: step.toolName,
      executionId,
      error: finalErrorMessage,
      attempts: attempt,
    });

    return toolExecution;
  }

  /**
   * Executes a tool with hard timeout and AbortController.
   * Ensures timed-out operations cannot produce accepted results afterwards.
   */
  private async executeWithTimeout(
    tool: any,
    input: unknown,
    context: ToolExecutionContext,
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): Promise<unknown> {
    const controller = new AbortController();
    let hasTimedOut = false;
    let hasAborted = false;
    let hasCompleted = false;

    // Link parent signal if provided
    const abortHandler = () => {
      hasAborted = true;
      controller.abort();
    };

    if (parentSignal) {
      if (parentSignal.aborted) {
        throw new CancellationError(tool.name, "Parent signal already aborted");
      }
      parentSignal.addEventListener("abort", abortHandler, { once: true });
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        hasTimedOut = true;
        controller.abort();
        cleanup();
        reject(new TimeoutError(tool.name, timeoutMs));
      }, timeoutMs);

      const onControllerAbort = () => {
        if (!hasTimedOut && !hasCompleted) {
          cleanup();
          reject(new CancellationError(tool.name, "Execution cancelled by AbortSignal"));
        }
      };

      controller.signal.addEventListener("abort", onControllerAbort, { once: true });

      const cleanup = () => {
        clearTimeout(timer);
        controller.signal.removeEventListener("abort", onControllerAbort);
        if (parentSignal) {
          parentSignal.removeEventListener("abort", abortHandler);
        }
      };

      const innerContext: ToolExecutionContext = {
        ...context,
        signal: controller.signal,
      };

      tool.execute(input, innerContext).then(
        (result: unknown) => {
          if (hasTimedOut || hasAborted) {
            // Discard late results from timed-out or aborted operations
            return;
          }
          hasCompleted = true;
          cleanup();
          resolve(result);
        },
        (error: unknown) => {
          if (hasTimedOut || hasAborted) {
            // Already handled by timeout or abort
            return;
          }
          hasCompleted = true;
          cleanup();
          reject(error);
        }
      );
    });
  }

  /**
   * Determines whether an error is safe to retry.
   * Permanent errors: permission failures, validation errors, unknown tools, cancellations.
   */
  private isRetryableError(err: unknown): boolean {
    if (err instanceof ToolPermissionError) return false;
    if (err instanceof ToolNotFoundError) return false;
    if (err instanceof ValidationError) return false;
    if (err instanceof CancellationError) return false;

    if (err instanceof TimeoutError) return true;
    if (err instanceof ToolExecutionError) return err.isRetryable;

    // Generic Error: check message
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes("permission") || msg.includes("denied") || msg.includes("validation")) {
        return false;
      }
      if (msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset")) {
        return true;
      }
    }

    return false;
  }
}
