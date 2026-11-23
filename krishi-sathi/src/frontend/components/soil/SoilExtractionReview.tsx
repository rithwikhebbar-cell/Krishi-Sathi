import React from "react";
import {
  SoilReportExtraction,
  ExtractedParameterCandidate,
} from "../../../agentic/contracts/soil/extractionTypes";

export interface SoilExtractionReviewProps {
  extraction: SoilReportExtraction;
  onEditParameter: (paramKey: string, candidate: ExtractedParameterCandidate) => void;
  farmerCorrections: Record<string, { value: number; unit?: string; method?: string; reason?: string }>;
}

export const SoilExtractionReview: React.FC<SoilExtractionReviewProps> = ({
  extraction,
  onEditParameter,
  farmerCorrections,
}) => {
  const candidateEntries = Object.entries(extraction.candidates);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Extracted Soil Test Parameters
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review original extracted values against standardized units before approval.
          </p>
        </div>
        {extraction.labMetadata?.labName && (
          <div className="text-right text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold block">{extraction.labMetadata.labName}</span>
            <span className="text-slate-400">Sample: {extraction.labMetadata.sampleCode || "N/A"}</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Parameter</th>
              <th className="py-3 px-4">Original Extracted</th>
              <th className="py-3 px-4">Normalized Value & Unit</th>
              <th className="py-3 px-4">Analytical Method</th>
              <th className="py-3 px-4">Confidence</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {candidateEntries.map(([key, c]) => {
              const correction = farmerCorrections[key];
              const isEdited = Boolean(correction || c.farmerCorrection);
              const displayValue = correction ? correction.value : c.normalizedValue;
              const displayUnit = correction?.unit || c.normalizedUnit;

              return (
                <tr
                  key={key}
                  className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                    isEdited ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                  }`}
                >
                  <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                    {c.rawKeyText}
                    {isEdited && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Edited
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono">
                    {c.rawValueText || "N/A"}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                    {displayValue !== null ? displayValue : "—"} {displayUnit || ""}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                    {c.extractedMethod || "UNSPECIFIED"}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        c.confidence >= 0.85
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : c.confidence >= 0.70
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {Math.round(c.confidence * 100)}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onEditParameter(key, c)}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
                    >
                      {isEdited ? "Edit Again" : "Correct"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {extraction.globalExtractionWarnings.length > 0 && (
        <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/40">
          <h5 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Extraction Warnings & Observations:
          </h5>
          <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
            {extraction.globalExtractionWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
