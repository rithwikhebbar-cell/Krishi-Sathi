import React from "react";
import { NutrientSplitApplicationSchedule } from "../../../agentic/contracts/soil/nutrientTypes";

export interface FertilizerApplicationScheduleProps {
  schedules: NutrientSplitApplicationSchedule[];
}

export const FertilizerApplicationSchedule: React.FC<FertilizerApplicationScheduleProps> = ({
  schedules,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          📅 Growth-Stage Split Application Schedule
        </h2>
        <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-1 rounded">
          {schedules.length} Stage Splits
        </span>
      </div>

      <div className="space-y-3">
        {schedules.map((schedule, idx) => (
          <div key={idx} className="p-3 border rounded-lg bg-slate-50/50 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-slate-900">{schedule.stageTitle}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {schedule.timingDescription}
              </span>
            </div>
            <div className="space-y-1">
              {schedule.fertilizers.map((fert, fIdx) => (
                <div key={fIdx} className="text-xs flex justify-between text-slate-700 pl-2 border-l-2 border-emerald-500">
                  <span>
                    <strong>{fert.commercialName}:</strong> {fert.applicationGuidance}
                  </span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap ml-2">
                    {fert.quantityKgPerHa} kg/ha ({fert.quantityKgPerAcre} kg/acre)
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 italic pt-1">{schedule.agronomicRationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
