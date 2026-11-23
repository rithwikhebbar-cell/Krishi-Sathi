import { z } from "zod";
import {
  ToolDefinition,
  ToolDefinitionSummary,
  ToolPermission,
  ToolExecutionContext,
} from "../contracts/types";
import {
  ToolNotFoundError,
  ToolPermissionError,
  ValidationError,
} from "../contracts/errors";
import { ToolPermissionSchema } from "../contracts/schemas";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any, any>>();

  register<TInput = unknown, TOutput = unknown>(tool: ToolDefinition<TInput, TOutput>): void {
    if (!tool.name || typeof tool.name !== "string" || !tool.name.trim()) {
      throw new ValidationError("Tool name must be a non-empty string");
    }

    if (this.tools.has(tool.name)) {
      throw new ValidationError(`Tool already registered: ${tool.name}`);
    }

    const permissionParsed = ToolPermissionSchema.safeParse(tool.permission);
    if (!permissionParsed.success) {
      throw new ValidationError(
        `Invalid permission '${tool.permission}' for tool '${tool.name}'`
      );
    }
    const normalizedPermission: ToolPermission = permissionParsed.data;

    this.tools.set(tool.name, {
      ...tool,
      permission: normalizedPermission,
    });
  }

  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinitionSummary[] {
    return Array.from(this.tools.values()).map(
      ({ name, description, permission, timeoutMs }) => ({
        name,
        description,
        permission,
        timeoutMs,
      })
    );
  }

  /**
   * Validates tool existence, permission checks, and input schema.
   * In Milestone 1.1, only READ_ONLY tools are allowed to execute.
   */
  validateInvocation(
    name: string,
    input: unknown
  ): { tool: ToolDefinition; validatedInput: unknown } {
    const tool = this.get(name);

    if (tool.permission === "BLOCKED") {
      throw new ToolPermissionError(name, tool.permission, "Tool is explicitly blocked by policy");
    }

    if (tool.permission === "REQUIRES_APPROVAL") {
      throw new ToolPermissionError(
        name,
        tool.permission,
        "Tool requires explicit human approval; approval mechanism is not configured in M1.1"
      );
    }

    if (tool.permission !== "READ_ONLY") {
      throw new ToolPermissionError(
        name,
        tool.permission,
        `Only READ_ONLY tools may execute in this runtime milestone`
      );
    }

    let validatedInput = input;
    if (tool.inputSchema) {
      const parsed = tool.inputSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(
          `Invalid input for tool '${name}': ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          parsed.error.issues
        );
      }
      validatedInput = parsed.data;
    }

    return { tool, validatedInput };
  }

  /**
   * Validates tool output against its outputSchema if defined.
   */
  validateOutput(name: string, output: unknown): unknown {
    const tool = this.get(name);
    if (tool.outputSchema) {
      const parsed = tool.outputSchema.safeParse(output);
      if (!parsed.success) {
        throw new ValidationError(
          `Invalid output produced by tool '${name}': ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          parsed.error.issues
        );
      }
      return parsed.data;
    }
    return output;
  }

  /**
   * Safely execute a tool through the registry after permission and schema checks.
   */
  async execute(
    name: string,
    input: unknown,
    context?: ToolExecutionContext
  ): Promise<unknown> {
    const { tool, validatedInput } = this.validateInvocation(name, input);
    const rawOutput = await tool.execute(validatedInput, context);
    return this.validateOutput(name, rawOutput);
  }
}
