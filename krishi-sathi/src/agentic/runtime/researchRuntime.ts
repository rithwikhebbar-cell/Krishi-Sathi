import { randomUUID } from "crypto";
import {
  DEFAULT_RUNTIME_LIMITS,
  ResearchExecutionResult,
  ResearchPlan,
  ResearchReport,
  ResearchTask,
  ResearchTaskInput,
  RuntimeLimits,
  TaskStatus,
  ToolExecution,
} from "../contracts/types";
import {
  BudgetExceededError,
  CancellationError,
  InvalidStateTransitionError,
  ReportValidationError,
  TimeoutError,
  ValidationError,
} from "../contracts/errors";
import { ResearchPlanSchema, ResearchTaskInputSchema, ResearchTaskSchema } from "../contracts/schemas";
import { ToolRegistry } from "../tools/registry";
import { EvidenceManager } from "../evidence/evidenceManager";
import { ExecutionEngine } from "../execution/executionEngine";
import { ModelProvider } from "../providers/types";
import { MockModelProvider } from "../providers/mockProvider";
import { TaskStateMachine } from "./stateMachine";
import { RuntimeEventBus } from "./eventBus";
import { ReportValidator } from "../validators/reportValidator";

export interface ResearchRuntimeOptions {
  tools?: ToolRegistry;
  provider?: ModelProvider;
  limits?: Partial<RuntimeLimits>;
  eventBus?: RuntimeEventBus;
}

export interface RunTaskOptions {
  signal?: AbortSignal;
  concurrent?: boolean;
}

export class ResearchRuntime {
  public readonly tools: ToolRegistry;
  public readonly provider: ModelProvider;
  public readonly limits: RuntimeLimits;
  public readonly eventBus: RuntimeEventBus;
  private readonly executionEngine: ExecutionEngine;

  constructor(
    toolsOrOptions?: ToolRegistry | ResearchRuntimeOptions,
    legacyLimits?: RuntimeLimits
  ) {
    if (toolsOrOptions instanceof ToolRegistry) {
      this.tools = toolsOrOptions;
      this.limits = { ...DEFAULT_RUNTIME_LIMITS, ...(legacyLimits ?? {}) };
      this.eventBus = new RuntimeEventBus();
      this.provider = new MockModelProvider();
    } else {
      const opts = toolsOrOptions ?? {};
      this.tools = opts.tools ?? new ToolRegistry();
      this.limits = { ...DEFAULT_RUNTIME_LIMITS, ...(opts.limits ?? {}) };
      this.eventBus = opts.eventBus ?? new RuntimeEventBus();
      this.provider = opts.provider ?? new MockModelProvider();
    }

    this.executionEngine = new ExecutionEngine(this.tools, this.limits, this.eventBus);
  }

  /**
   * Compatibility method from starter: validatePlan
   */
  validatePlan(plan: ResearchPlan): void {
    if (plan.steps.length > this.limits.maxSteps) {
      throw new BudgetExceededError("plan steps", this.limits.maxSteps, plan.steps.length);
    }
    for (const step of plan.steps) {
      this.tools.get(step.toolName);
    }
  }

  /**
   * Compatibility method from starter: executePlan
   */
  async executePlan(task: ResearchTask, plan: ResearchPlan): Promise<unknown[]> {
    this.validatePlan(plan);
    const executions = await this.executionEngine.executePlan(plan, {
      taskId: task.id,
    });
    return executions.map((e) => e.output);
  }

  /**
   * Complete bounded autonomous research task lifecycle.
   */
  async runTask(
    input: ResearchTaskInput,
    options: RunTaskOptions = {}
  ): Promise<ResearchExecutionResult> {
    const startTime = Date.now();
    const taskId = input.id ?? `task_${randomUUID()}`;
    const errors: string[] = [];
    const stateMachine = new TaskStateMachine("CREATED");
    const evidenceManager = new EvidenceManager(this.limits.maxEvidenceItems);
    let plan: ResearchPlan | undefined;
    let report: ResearchReport | undefined;
    let toolExecutions: ToolExecution[] = [];

    const now = new Date().toISOString();
    const task: ResearchTask = {
      id: taskId,
      ownerId: input.ownerId,
      question: input.question,
      context: input.context ?? {},
      status: "CREATED",
      createdAt: now,
      updatedAt: now,
    };

    // Setup global task timeout controller
    const taskTimeoutController = new AbortController();
    const taskTimeoutMs = this.limits.totalTaskTimeoutMs;
    const taskTimer = setTimeout(() => {
      taskTimeoutController.abort();
    }, taskTimeoutMs);

    // Merge caller signal with task timeout signal
    const effectiveController = new AbortController();
    const handleCallerAbort = () => effectiveController.abort();
    const handleTimeoutAbort = () => effectiveController.abort();

    if (options.signal) {
      options.signal.addEventListener("abort", handleCallerAbort, { once: true });
    }
    taskTimeoutController.signal.addEventListener("abort", handleTimeoutAbort, { once: true });

    const cleanupControllers = () => {
      clearTimeout(taskTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", handleCallerAbort);
      }
      taskTimeoutController.signal.removeEventListener("abort", handleTimeoutAbort);
    };

    const transitionState = (next: TaskStatus, reason?: string) => {
      stateMachine.transitionTo(next, reason);
      task.status = next;
      task.updatedAt = new Date().toISOString();
    };

    try {
      this.eventBus.emit(taskId, "TASK_CREATED", {
        question: task.question,
        ownerId: task.ownerId,
      });

      if (effectiveController.signal.aborted) {
        throw this.checkAbortReason(options.signal, taskTimeoutController.signal, taskTimeoutMs);
      }

      // STEP 1: VALIDATING
      transitionState("VALIDATING", "Validating task input schema and constraints");
      this.eventBus.emit(taskId, "TASK_VALIDATING");

      const validatedInput = ResearchTaskInputSchema.safeParse(input);
      if (!validatedInput.success) {
        throw new ValidationError(
          `Task input validation failed: ${validatedInput.error.issues.map((i) => i.message).join(", ")}`,
          validatedInput.error.issues
        );
      }
      this.eventBus.emit(taskId, "TASK_VALIDATED");

      if (effectiveController.signal.aborted) {
        throw this.checkAbortReason(options.signal, taskTimeoutController.signal, taskTimeoutMs);
      }

      // STEP 2: PLANNING
      transitionState("PLANNING", "Generating bounded research execution plan");
      this.eventBus.emit(taskId, "PLAN_GENERATION_STARTED");

      const availableTools = this.tools.list();
      plan = await this.provider.createPlan(task, availableTools, effectiveController.signal);

      // Validate plan schema and bounds
      const planValidation = ResearchPlanSchema.safeParse(plan);
      if (!planValidation.success) {
        throw new ValidationError(
          `Generated plan violates schema: ${planValidation.error.issues.map((i) => i.message).join(", ")}`
        );
      }

      if (plan.steps.length > this.limits.maxSteps) {
        throw new BudgetExceededError("plan steps", this.limits.maxSteps, plan.steps.length);
      }

      // Validate that tools exist and are allowed
      for (const step of plan.steps) {
        this.tools.validateInvocation(step.toolName, step.input);
      }

      this.eventBus.emit(taskId, "PLAN_GENERATED", {
        stepCount: plan.steps.length,
        explanation: plan.explanation,
      });
      this.eventBus.emit(taskId, "PLAN_VALIDATED");

      if (effectiveController.signal.aborted) {
        throw this.checkAbortReason(options.signal, taskTimeoutController.signal, taskTimeoutMs);
      }

      // STEP 3: EXECUTING
      transitionState("EXECUTING", "Executing planned research tools");

      toolExecutions = await this.executionEngine.executePlan(plan, {
        taskId,
        signal: effectiveController.signal,
        concurrent: options.concurrent,
      });

      // Register evidence from tool outputs
      for (const execution of toolExecutions) {
        if (execution.status === "COMPLETED" && execution.output) {
          this.registerEvidenceFromOutput(taskId, execution, evidenceManager);
        }
      }

      if (effectiveController.signal.aborted) {
        throw this.checkAbortReason(options.signal, taskTimeoutController.signal, taskTimeoutMs);
      }

      // STEP 4: EVALUATING
      transitionState("EVALUATING", "Evaluating gathered evidence sufficiency");
      this.eventBus.emit(taskId, "EVALUATION_COMPLETED", {
        evidenceCount: evidenceManager.count(),
      });

      if (effectiveController.signal.aborted) {
        throw this.checkAbortReason(options.signal, taskTimeoutController.signal, taskTimeoutMs);
      }

      // STEP 5: SYNTHESIZING
      transitionState("SYNTHESIZING", "Synthesizing evidence-grounded research report");
      this.eventBus.emit(taskId, "SYNTHESIS_STARTED");

      report = await this.provider.synthesize(
        task,
        evidenceManager.list(),
        effectiveController.signal
      );

      // Enhance report with traceability metadata, sources, and conflict awareness
      if (report) {
        if (!report.question) report.question = task.question;
        if (!report.sources || report.sources.length === 0) {
          report.sources = evidenceManager.list().map((e) => ({
            evidenceId: e.id,
            title: e.sourceTitle,
            institution: e.publisher || e.sourceTitle,
            url: e.sourceUri,
            freshness: e.freshness,
          }));
        }
        if (!report.conflictingEvidence || report.conflictingEvidence.length === 0) {
          report.conflictingEvidence = evidenceManager.getConflictingEvidence();
        }
      }

      this.eventBus.emit(taskId, "SYNTHESIS_COMPLETED");

      if (effectiveController.signal.aborted) {
        throw this.checkAbortReason(options.signal, taskTimeoutController.signal, taskTimeoutMs);
      }

      // STEP 6: VALIDATING_REPORT
      transitionState("VALIDATING_REPORT", "Validating citations, limitations, and report integrity");
      this.eventBus.emit(taskId, "REPORT_VALIDATING");

      const reportValidation = ReportValidator.validate(report, evidenceManager);
      if (!reportValidation.isValid) {
        throw new ReportValidationError(reportValidation.errors);
      }
      this.eventBus.emit(taskId, "REPORT_VALIDATED");

      // STEP 7: COMPLETED
      transitionState("COMPLETED", "Task completed successfully");
      this.eventBus.emit(taskId, "TASK_COMPLETED", {
        durationMs: Date.now() - startTime,
        evidenceCount: evidenceManager.count(),
        findingsCount: report.findings.length,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(errorMsg);

      if (err instanceof TimeoutError || taskTimeoutController.signal.aborted) {
        if (!stateMachine.isTerminal()) {
          transitionState("TIMED_OUT", errorMsg);
        }
        this.eventBus.emit(taskId, "TASK_TIMED_OUT", { error: errorMsg });
      } else if (err instanceof CancellationError || options.signal?.aborted) {
        if (!stateMachine.isTerminal()) {
          transitionState("CANCELLED", errorMsg);
        }
        this.eventBus.emit(taskId, "TASK_CANCELLED", { error: errorMsg });
      } else {
        if (!stateMachine.isTerminal()) {
          transitionState("FAILED", errorMsg);
        }
        this.eventBus.emit(taskId, "TASK_FAILED", { error: errorMsg });
      }
    } finally {
      cleanupControllers();
    }

    return {
      task,
      status: task.status,
      plan,
      report,
      evidence: evidenceManager.list(),
      toolExecutions,
      events: this.eventBus.getEvents(taskId),
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  private registerEvidenceFromOutput(
    taskId: string,
    execution: ToolExecution,
    evidenceManager: EvidenceManager
  ): void {
    const output = execution.output as any;
    let excerpt = "";
    let sourceTitle = `Tool: ${execution.toolName}`;
    let sourceUri = `tool://${execution.toolName}`;
    let publisher: string | undefined;
    let evidenceType: any = "AGRONOMIC_GUIDELINE";
    let isUntrusted = true;

    if (typeof output === "string") {
      excerpt = output;
    } else if (typeof output === "object" && output !== null) {
      // 1. Deterministic Calculation Engine
      if (output.engineVersion) {
        evidenceType = "DETERMINISTIC_CALCULATION";
        isUntrusted = false; // Authoritative internal calculation
        sourceTitle = `Deterministic Calculation: ${output.crop} Water Balance (${output.engineVersion})`;
        sourceUri = `engine://${output.engineVersion}/${output.crop}`;
        publisher = "FAO-56 / ICAR Authoritative Computational Engine";
        excerpt = `Deterministic Result (${output.calculationMethod}): Crop=${output.crop}, GrowthStage=${output.growthStage}, Kc=${output.cropCoefficientKc}, ET0=${output.referenceEt0MmDay} mm/day -> ETc=${output.cropWaterRequirementEtcMmDay} mm/day. Effective Rainfall=${output.effectiveRainfallMm} mm. Net Irrigation Requirement=${output.netIrrigationRequirementMmDay} mm/day (${output.dailyIrrigationVolumeLitersPerHectare} L/ha/day).`;
      }
      // 2. Weather Output
      else if (output.currentConditions || output.dailyForecast) {
        evidenceType = "WEATHER_FORECAST";
        sourceTitle = `Open-Meteo Weather for ${output.locationName}${output.adminRegion ? `, ${output.adminRegion}` : ""}`;
        sourceUri = `https://open-meteo.com/forecast/${encodeURIComponent(output.locationName)}`;
        publisher = output.provider || "Open-Meteo";

        const parts: string[] = [];
        if (output.currentConditions) {
          parts.push(
            `Current: ${output.currentConditions.weatherDescription}, Temp: ${output.currentConditions.temperatureC}°C, Humidity: ${output.currentConditions.relativeHumidityPercent}%, Wind: ${output.currentConditions.windSpeedKmh} km/h.`
          );
        }
        if (output.dailyForecast && output.dailyForecast.length > 0) {
          const forecastSummaries = output.dailyForecast.slice(0, 3).map(
            (d: any) => `${d.date}: ${d.tempMinC}°C-${d.tempMaxC}°C, Rain: ${d.precipitationSumMm}mm (Prob: ${d.precipitationProbabilityPercent}%)`
          );
          parts.push(`Forecast: ${forecastSummaries.join("; ")}.`);
        }
        excerpt = parts.join(" ");
      }
      // 3. Agricultural Knowledge Output
      else if (output.excerpt) {
        excerpt = output.excerpt;
        if (output.sourceTitle) sourceTitle = output.sourceTitle;
        if (output.sourceInstitution) publisher = output.sourceInstitution;
        if (output.sourceUrl) sourceUri = output.sourceUrl;
        evidenceType = "RESEARCH_DOCUMENT";
      } else if (Array.isArray(output.guidelines)) {
        excerpt = output.guidelines.join(" ");
        if (output.source) {
          sourceTitle = output.source;
          publisher = output.source;
        }
      } else if (output.conditions) {
        excerpt = `Weather conditions at ${output.location}: ${output.conditions}, temp ${output.temperatureC}°C, humidity ${output.humidityPercent}%, rainfall prob ${output.rainfallProbabilityPercent}%.`;
        if (output.source) sourceTitle = output.source;
      } else {
        excerpt = JSON.stringify(output);
      }
    }

    if (excerpt.trim().length > 0) {
      try {
        const evidence = evidenceManager.register({
          taskId,
          sourceUri,
          sourceTitle,
          publisher,
          excerpt,
          evidenceType,
          retrievalMethod: `tool:${execution.toolName}`,
          isUntrusted,
        });

        this.eventBus.emit(taskId, "EVIDENCE_REGISTERED", {
          evidenceId: evidence.id,
          sourceTitle: evidence.sourceTitle,
          evidenceType: evidence.evidenceType,
          contentHash: evidence.contentHash,
        });
      } catch (err) {
        // If evidence budget exceeded or other evidence error, log it
        console.warn(`Evidence registration note for step ${execution.stepId}:`, err);
      }
    }
  }

  private checkAbortReason(
    callerSignal?: AbortSignal,
    timeoutSignal?: AbortSignal,
    timeoutMs?: number
  ): Error {
    if (callerSignal?.aborted) {
      return new CancellationError("Task execution", "Cancelled by client AbortSignal");
    }
    if (timeoutSignal?.aborted) {
      return new TimeoutError("Task execution", timeoutMs ?? 60_000);
    }
    return new CancellationError("Task execution", "Aborted by signal");
  }
}
