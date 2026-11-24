import React from "react";
import { AgriculturalAdvisory } from "../../../agentic/contracts/soil/advisoryTypes";
import { SoilHealthSummary } from "./SoilHealthSummary";
import { NutrientRecommendationCard } from "./NutrientRecommendationCard";
import { FertilizerApplicationSchedule } from "./FertilizerApplicationSchedule";
import { WaterManagementAdvisory } from "./WaterManagementAdvisory";
import { WeatherContextCard } from "./WeatherContextCard";
import { AgriculturalEvidencePanel } from "./AgriculturalEvidencePanel";
import { AdvisoryConfidenceIndicator } from "./AdvisoryConfidenceIndicator";
import { AdvisoryLimitationsPanel } from "./AdvisoryLimitationsPanel";

export interface AgriculturalAdvisoryDashboardProps {
  advisory: AgriculturalAdvisory;
  onRefresh?: () => void;
  isLoadingRefresh?: boolean;
}

export const AgriculturalAdvisoryDashboard: React.FC<AgriculturalAdvisoryDashboardProps> = ({
  advisory,
  onRefresh,
  isLoadingRefresh = false,
}) => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">
              🌾 Agricultural Intelligence Advisory
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
              v{advisory.version}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Field: <span className="font-semibold text-slate-900">{advisory.fieldOverview.fieldName}</span> | Crop:{" "}
            <span className="font-semibold text-slate-900">
              {advisory.cropName} {advisory.cropVariety ? `(${advisory.cropVariety})` : ""}
            </span>{" "}
            | Target Yield:{" "}
            <span className="font-semibold text-slate-900">{advisory.targetYieldQuintalsPerHa} q/ha</span> (
            {advisory.croppingSeason})
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Generated at: {new Date(advisory.generatedAt).toLocaleString()} | Model: {advisory.modelVersion}
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoadingRefresh}
            className="px-4 py-2 bg-emerald-600 text-white font-medium text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
          >
            {isLoadingRefresh ? "Refreshing Advisory..." : "🔄 Refresh with Live Weather"}
          </button>
        )}
      </div>

      {/* Confidence and Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <SoilHealthSummary soilHealth={advisory.soilHealth} fieldOverview={advisory.fieldOverview} />
          <NutrientRecommendationCard
            nutrientManagement={advisory.nutrientManagement}
            methodology={advisory.deterministicCalculation.methodology}
          />
          <FertilizerApplicationSchedule schedules={advisory.deterministicCalculation.splitSchedules} />
          <WaterManagementAdvisory waterManagement={advisory.waterManagement} />
        </div>

        <div className="space-y-6">
          <AdvisoryConfidenceIndicator confidence={advisory.confidence} />
          <WeatherContextCard
            weatherSummary={advisory.weatherSummary}
            cropWaterAssessment={advisory.cropWaterAssessment}
          />
          <AdvisoryLimitationsPanel
            evidenceAndLimitations={advisory.evidenceAndLimitations}
            unsupportedParameters={advisory.deterministicCalculation.unsupportedParameters}
          />
          <AgriculturalEvidencePanel
            supportingSources={advisory.evidenceAndLimitations.supportingSources}
          />
        </div>
      </div>
    </div>
  );
};
