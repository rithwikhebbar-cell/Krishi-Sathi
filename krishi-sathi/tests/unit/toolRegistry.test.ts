import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../../src/agentic/toolRegistry";
import { ToolPermissionError, ToolNotFoundError, ValidationError } from "../../src/agentic/contracts/errors";
import { z } from "zod";

describe("ToolRegistry", () => {
  it("registers and retrieves read-only tools", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "sample.lookup",
      description: "Sample read-only lookup",
      permission: "read_only" as any,
      timeoutMs: 1000,
      execute: async () => ({ ok: true }),
    });
    expect(registry.get("sample.lookup").name).toBe("sample.lookup");
  });

  it("rejects duplicate tool names", () => {
    const registry = new ToolRegistry();
    const tool = {
      name: "sample.lookup",
      description: "lookup",
      permission: "read_only" as any,
      timeoutMs: 1000,
      execute: async () => null,
    };
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow(/already registered/);
  });

  it("rejects unregistered tool lookup with ToolNotFoundError", () => {
    const registry = new ToolRegistry();
    expect(() => registry.get("nonexistent.tool")).toThrow(ToolNotFoundError);
  });

  it("rejects execution of BLOCKED tools", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "chemical.spray",
      description: "Controls autonomous chemical sprayer",
      permission: "BLOCKED",
      timeoutMs: 1000,
      execute: async () => ({ success: true }),
    });

    expect(() => registry.validateInvocation("chemical.spray", {})).toThrow(ToolPermissionError);
  });

  it("rejects execution of REQUIRES_APPROVAL tools without an approval mechanism", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "order.fertilizer",
      description: "Purchases fertilizer bulk supplies",
      permission: "REQUIRES_APPROVAL",
      timeoutMs: 1000,
      execute: async () => ({ ordered: true }),
    });

    expect(() => registry.validateInvocation("order.fertilizer", {})).toThrow(ToolPermissionError);
  });

  it("validates input schema on invocation", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "soil.test",
      description: "Fetches soil nutrients",
      permission: "READ_ONLY",
      timeoutMs: 1000,
      inputSchema: z.object({
        fieldId: z.string().min(3),
        depthCm: z.number().positive(),
      }),
      execute: async (input: any) => ({ nitrogen: "high" }),
    });

    // Valid invocation
    const { validatedInput } = registry.validateInvocation("soil.test", {
      fieldId: "field-north-1",
      depthCm: 15,
    });
    expect(validatedInput).toEqual({ fieldId: "field-north-1", depthCm: 15 });

    // Invalid invocation: depthCm is negative
    expect(() =>
      registry.validateInvocation("soil.test", { fieldId: "f1", depthCm: -5 })
    ).toThrow(ValidationError);
  });

  it("validates output schema after execution", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "failing.output.tool",
      description: "Returns wrong type",
      permission: "READ_ONLY",
      timeoutMs: 1000,
      outputSchema: z.object({ score: z.number() }),
      execute: async () => ({ score: "not-a-number" as any }),
    });

    await expect(registry.execute("failing.output.tool", {})).rejects.toThrow(ValidationError);
  });

  it("lists summaries of registered tools", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "tool.a",
      description: "Description A",
      permission: "READ_ONLY",
      timeoutMs: 2000,
      execute: async () => null,
    });

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      name: "tool.a",
      description: "Description A",
      permission: "READ_ONLY",
      timeoutMs: 2000,
    });
  });
});
