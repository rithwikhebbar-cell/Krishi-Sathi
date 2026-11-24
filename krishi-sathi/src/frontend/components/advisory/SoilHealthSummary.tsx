import React from "react";
import { AdvisorySoilHealth, AdvisoryFieldOverview } from "../../../agentic/contracts/soil/advisoryTypes";

export interface SoilHealthSummaryProps {
  soilHealth: AdvisorySoilHealth;
  fieldOverview: AdvisoryFieldOverview;
}

export const SoilHealthSummary: React.FC<SoilHealthSummaryProps> = ({ soilHealth, fieldOverview }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          🧪 Soil Fertility & Chemical Health
        </h2>
        <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-1 rounded">
          ICAR Benchmark Rating
        </span>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed font-medium">
        {soilHealth.interpretationSummary}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            pH & Salinity
          </span>
          <p className="text-xs text-slate-700 mt-1">{soilHealth.phAndSalinityAssessment}</p>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Organic Carbon Status
          </span>
          <p className="text-xs text-slate-700 mt-1">{soilHealth.organicCarbonAssessment}</p>
        </div>
      </div>

      {soilHealth.deficienciesOrExcesses.length > 0 && (
        <div className="pt-2">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block mb-1">
            ⚠️ Identified Deficiencies / Excesses
          </span>
          <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
            {soilHealth.deficienciesOrExcesses.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
