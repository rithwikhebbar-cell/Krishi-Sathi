import React from "react";
import {
  AdvisoryConfidenceAssessment,
  AdvisoryConfidenceLevel,
} from "../../../agentic/contracts/soil/advisoryTypes";

export interface AdvisoryConfidenceIndicatorProps {
  confidence: AdvisoryConfidenceAssessment;
}

const getBadgeColor = (level: AdvisoryConfidenceLevel) => {
  switch (level) {
    case "HIGH":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "MODERATE":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "LOW":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "INSUFFICIENT_DATA":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

export const AdvisoryConfidenceIndicator: React.FC<AdvisoryConfidenceIndicatorProps> = ({ confidence }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          🎯 Advisory Confidence
        </h3>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(
            confidence.overallCompleteness
          )}`}
        >
          {confidence.overallCompleteness}
        </span>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-600">Soil Data Quality:</span>
          <span className={`px-2 py-0.5 rounded border text-3xs font-semibold ${getBadgeColor(confidence.soilDataQuality)}`}>
            {confidence.soilDataQuality}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-600">Calculation Validity:</span>
          <span className={`px-2 py-0.5 rounded border text-3xs font-semibold ${getBadgeColor(confidence.calculationValidity)}`}>
            {confidence.calculationValidity}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-600">Evidence Support:</span>
          <span className={`px-2 py-0.5 rounded border text-3xs font-semibold ${getBadgeColor(confidence.evidenceQuality)}`}>
            {confidence.evidenceQuality}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-500 pt-2 border-t leading-relaxed">
        {confidence.confidenceRationale}
      </p>
    </div>
  );
};
