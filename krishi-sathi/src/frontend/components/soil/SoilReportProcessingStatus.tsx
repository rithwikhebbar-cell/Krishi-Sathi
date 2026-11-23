import React from "react";
import { ExtractionReviewStatus } from "../../../agentic/contracts/soil/extractionTypes";

export interface SoilReportProcessingStatusProps {
  status: ExtractionReviewStatus | "UPLOADED" | "PROCESSING";
  confidence?: number;
  warningsCount?: number;
}

export const SoilReportProcessingStatus: React.FC<SoilReportProcessingStatusProps> = ({
  status,
  confidence,
  warningsCount = 0,
}) => {
  const steps = [
    { id: "UPLOADED", label: "Uploaded" },
    { id: "PROCESSING", label: "Processing" },
    { id: "PENDING_APPROVAL", label: "Review Required" },
    { id: "APPROVED", label: "Approved & Active" },
  ];

  const getStepState = (stepId: string) => {
    if (status === "REJECTED") {
      return stepId === "PENDING_APPROVAL" ? "rejected" : "inactive";
    }
    if (status === "APPROVED") return "completed";
    if (status === "PENDING_APPROVAL") {
      if (stepId === "UPLOADED" || stepId === "PROCESSING") return "completed";
      if (stepId === "PENDING_APPROVAL") return "current";
      return "upcoming";
    }
    if (status === "PROCESSING") {
      if (stepId === "UPLOADED") return "completed";
      if (stepId === "PROCESSING") return "current";
      return "upcoming";
    }
    return stepId === "UPLOADED" ? "current" : "upcoming";
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Report Status
        </h4>
        <div className="flex items-center space-x-2">
          {confidence !== undefined && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                confidence >= 0.85
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : confidence >= 0.70
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
              }`}
            >
              Confidence: {Math.round(confidence * 100)}%
            </span>
          )}
          {warningsCount > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {warningsCount} Warning(s)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {steps.map((s, idx) => {
          const state = getStepState(s.id);
          return (
            <div key={s.id} className="flex flex-col items-center text-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  state === "completed"
                    ? "bg-emerald-600 text-white"
                    : state === "current"
                    ? "bg-amber-500 text-white ring-4 ring-amber-100 dark:ring-amber-950/50"
                    : state === "rejected"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                }`}
              >
                {state === "completed" ? "✓" : state === "rejected" ? "✕" : idx + 1}
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-2">
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
