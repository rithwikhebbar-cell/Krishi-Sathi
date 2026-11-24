import React from "react";
import { CropWaterOutput } from "../../../agentic/engines/types";

export interface WeatherContextCardProps {
  weatherSummary?: string;
  cropWaterAssessment?: CropWaterOutput;
}

export const WeatherContextCard: React.FC<WeatherContextCardProps> = ({
  weatherSummary,
  cropWaterAssessment,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        🌦️ Local Weather & Rainfall
      </h3>
      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
        {weatherSummary || "Live meteorological forecast active for field location."}
      </p>
      {cropWaterAssessment && (
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
          <div>
            <span className="text-slate-400 block">Forecast Rainfall:</span>
            <span className="font-semibold text-slate-800">{cropWaterAssessment.forecastRainfallMm} mm</span>
          </div>
          <div>
            <span className="text-slate-400 block">Effective Rainfall:</span>
            <span className="font-semibold text-slate-800">{cropWaterAssessment.effectiveRainfallMm} mm</span>
          </div>
        </div>
      )}
    </div>
  );
};
