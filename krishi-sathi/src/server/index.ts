import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { ResearchRuntime } from "../agentic/runtime/researchRuntime";
import { createDefaultToolRegistry } from "../agentic/tools";
import { createDefaultModelProvider } from "../agentic/providers";
import { ResearchExecutionResult } from "../agentic/contracts/types";
import { ResearchTaskInputSchema } from "../agentic/contracts/schemas";
import { soilRouter } from "./routes/soilRoutes";

export const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", soilRouter);

// In-memory task registry for runtime tracking & cancellation
export interface TaskRecord {
  taskId: string;
  ownerId: string;
  status: string;
  createdAt: string;
  controller: AbortController;
  result?: ResearchExecutionResult;
}

export const taskStore = new Map<string, TaskRecord>();

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "krishi-sathi-api",
    milestone: "1.2 - Research Tools & Evidence Retrieval",
  });
});

/**
 * Lists available agricultural tools and their permission classifications.
 */
app.get("/api/research/tools", (_req, res) => {
  const tools = createDefaultToolRegistry();
  res.json({
    tools: tools.list(),
  });
});

/**
 * Submits an agricultural research question and executes the bounded research workflow.
 */
app.post("/api/research/tasks", async (req, res) => {
  try {
    const rawBody = req.body || {};
    const inputCandidate = {
      id: rawBody.id || `task_${randomUUID()}`,
      ownerId: rawBody.ownerId || "anonymous-farmer",
      question: rawBody.question,
      context: rawBody.context || {},
    };

    const parsedInput = ResearchTaskInputSchema.safeParse(inputCandidate);
    if (!parsedInput.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        issues: parsedInput.error.issues,
      });
    }

    const controller = new AbortController();
    const taskRecord: TaskRecord = {
      taskId: parsedInput.data.id!,
      ownerId: parsedInput.data.ownerId,
      status: "EXECUTING",
      createdAt: new Date().toISOString(),
      controller,
    };
    taskStore.set(taskRecord.taskId, taskRecord);

    const runtime = new ResearchRuntime({
      tools: createDefaultToolRegistry(),
      provider: createDefaultModelProvider(),
    });

    const result = await runtime.runTask(parsedInput.data, {
      signal: controller.signal,
    });

    taskRecord.status = result.status;
    taskRecord.result = result;

    const httpStatus = result.status === "COMPLETED" ? 200 : 422;
    return res.status(httpStatus).json({
      taskId: taskRecord.taskId,
      status: result.status,
      report: result.report,
      evidenceCount: result.evidence.length,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message,
    });
  }
});

/**
 * Retrieves the status and full report of a research task.
 */
app.get("/api/research/tasks/:id", (req, res) => {
  const record = taskStore.get(req.params.id);
  if (!record) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: `Research task '${req.params.id}' not found.`,
    });
  }

  res.json({
    taskId: record.taskId,
    status: record.status,
    createdAt: record.createdAt,
    result: record.result,
  });
});

/**
 * Retrieves the evidence provenance items gathered for a research task.
 */
app.get("/api/research/tasks/:id/evidence", (req, res) => {
  const record = taskStore.get(req.params.id);
  if (!record || !record.result) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: `No evidence found for task '${req.params.id}'.`,
    });
  }

  res.json({
    taskId: record.taskId,
    evidence: record.result.evidence,
    conflicts: record.result.report?.conflictingEvidence || [],
  });
});

/**
 * Cancels a running research task via its AbortController.
 */
app.post("/api/research/tasks/:id/cancel", (req, res) => {
  const record = taskStore.get(req.params.id);
  if (!record) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: `Research task '${req.params.id}' not found.`,
    });
  }

  record.controller.abort();
  record.status = "CANCELLED";

  res.json({
    taskId: record.taskId,
    status: "CANCELLED",
    message: "Research task cancelled successfully.",
  });
});

const port = Number(process.env.PORT ?? 5000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Krishi Sathi API listening on port ${port}`);
  });
}
