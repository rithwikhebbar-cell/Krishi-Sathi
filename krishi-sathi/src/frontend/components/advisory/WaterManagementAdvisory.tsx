import React from "react";
import { AdvisoryWaterManagement } from "../../../agentic/contracts/soil/advisoryTypes";

export interface WaterManagementAdvisoryProps {
  waterManagement: AdvisoryWaterManagement;
}

export const WaterManagementAdvisory: React.FC<WaterManagementAdvisoryProps> = ({ waterManagement }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          💧 Crop-Water & Irrigation Demand (FAO-56)
        </h2>
        <span className="text-xs bg-sky-50 text-sky-700 font-semibold px-2 py-1 rounded">
          Water Balance
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-sky-50/50 border border-sky-100 rounded-lg text-center">
          <span className="text-xs text-slate-500 block">Crop Evapotranspiration (ETc)</span>
          <span className="text-lg font-bold text-sky-900">
            {waterManagement.protectedEtcMmDay} <span className="text-xs font-normal">mm/day</span>
          </span>
        </div>
        <div className="p-3 bg-sky-50/50 border border-sky-100 rounded-lg text-center">
          <span className="text-xs text-slate-500 block">Net Irrigation Required</span>
          <span className="text-lg font-bold text-sky-900">
            {waterManagement.protectedNetIrrigationMmDay} <span className="text-xs font-normal">mm/day</span>
          </span>
        </div>
      </div>

      <div className="space-y-2 text-xs text-slate-600">
        <p>
          <strong className="text-slate-700">Assessment:</strong> {waterManagement.cropWaterSummary}
        </p>
        <p>
          <strong className="text-slate-700">Weather Context:</strong> {waterManagement.weatherAndRainfallContext}
        </p>
      </div>

      {waterManagement.irrigationPracticesAndRestrictions.length > 0 && (
        <div className="pt-2">
          <span className="text-xs font-semibold text-slate-700 block mb-1">
            Recommended Irrigation Practices:
          </span>
          <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
            {waterManagement.irrigationPracticesAndRestrictions.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
