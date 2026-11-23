import { describe, expect, it } from "vitest";
import { ExecutionEngine } from "../../src/agentic/execution/executionEngine";
import { ToolRegistry } from "../../src/agentic/tools/registry";
import { DEFAULT_RUNTIME_LIMITS } from "../../src/agentic/contracts/types";
import { TimeoutError, CancellationError } from "../../src/agentic/contracts/errors";
import { z } from "zod";

describe("ExecutionEngine", () => {
  it("executes steps sequentially and returns structured results", async () => {
    const tools = new ToolRegistry();
    tools.register({
      name: "calc.add",
      description: "Adds numbers",
      permission: "READ_ONLY",
      timeoutMs: 1000,
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => ({ sum: a + b }),
    });

    const engine = new ExecutionEngine(tools, DEFAULT_RUNTIME_LIMITS);
    const plan = {
      taskId: "task-1",
      steps: [
        { id: "step-1", purpose: "First addition", toolName: "calc.add", input: { a: 10, b: 20 } },
        { id: "step-2", purpose: "Second addition", toolName: "calc.add", input: { a: 100, b: 200 } },
      ],
      generatedAt: new Date().toISOString(),
    };

    const executions = await engine.executePlan(plan, { taskId: "task-1" });
    expect(executions).toHaveLength(2);
    expect(executions[0].status).toBe("COMPLETED");
    expect(executions[0].output).toEqual({ sum: 30 });
    expect(executions[1].status).toBe("COMPLETED");
    expect(executions[1].output).toEqual({ sum: 300 });
  });

  it("enforces per-tool execution timeouts and marks execution TIMED_OUT", async () => {
    const tools = new ToolRegistry();
    tools.register({
      name: "slow.tool",
      description: "Exceeds timeout",
      permission: "READ_ONLY",
      timeoutMs: 100, // 100ms timeout
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { done: true };
      },
    });

    const engine = new ExecutionEngine(tools, {
      ...DEFAULT_RUNTIME_LIMITS,
      toolTimeoutMs: 100,
      maxRetriesPerTool: 0,
    });

    const step = {
      id: "s1",
      purpose: "Slow step",
      toolName: "slow.tool",
      input: {},
    };

    const execution = await engine.executeStep("task-1", step);
    expect(execution.status).toBe("TIMED_OUT");
    expect(execution.error).toMatch(/timed out/i);
  });

  it("retries retryable errors up to maxRetries", async () => {
    const tools = new ToolRegistry();
    let attempts = 0;

    tools.register({
      name: "flaky.tool",
      description: "Fails once then succeeds",
      permission: "READ_ONLY",
      timeoutMs: 1000,
      retryPolicy: { maxRetries: 2, backoffMs: 20 },
      execute: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Network timeout: temporary connection reset");
        }
        return { success: true, attempts };
      },
    });

    const engine = new ExecutionEngine(tools, DEFAULT_RUNTIME_LIMITS);
    const step = {
      id: "s1",
      purpose: "Flaky test",
      toolName: "flaky.tool",
      input: {},
    };

    const execution = await engine.executeStep("task-1", step);
    expect(execution.status).toBe("COMPLETED");
    expect(execution.attempts).toBe(2);
    expect(execution.output).toEqual({ success: true, attempts: 2 });
  });

  it("does not retry permanent validation errors", async () => {
    const tools = new ToolRegistry();
    tools.register({
      name: "strict.tool",
      description: "Requires valid number",
      permission: "READ_ONLY",
      timeoutMs: 1000,
      retryPolicy: { maxRetries: 3 },
      inputSchema: z.object({ value: z.number() }),
      execute: async ({ value }) => ({ value }),
    });

    const engine = new ExecutionEngine(tools, DEFAULT_RUNTIME_LIMITS);
    const step = {
      id: "s1",
      purpose: "Bad input",
      toolName: "strict.tool",
      input: { value: "not-a-number" },
    };

    await expect(engine.executeStep("task-1", step)).rejects.toThrow();
  });

  it("supports cancellation via AbortSignal", async () => {
    const tools = new ToolRegistry();
    tools.register({
      name: "long.tool",
      description: "Long running",
      permission: "READ_ONLY",
      timeoutMs: 5000,
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { done: true };
      },
    });

    const engine = new ExecutionEngine(tools, DEFAULT_RUNTIME_LIMITS);
    const controller = new AbortController();

    const plan = {
      taskId: "task-1",
      steps: [{ id: "s1", purpose: "Long operation", toolName: "long.tool", input: {} }],
      generatedAt: new Date().toISOString(),
    };

    // Trigger abort shortly after start
    setTimeout(() => controller.abort(), 50);

    const executions = await engine.executePlan(plan, {
      taskId: "task-1",
      signal: controller.signal,
    });

    expect(executions[0].status).toBe("CANCELLED");
  });
});
