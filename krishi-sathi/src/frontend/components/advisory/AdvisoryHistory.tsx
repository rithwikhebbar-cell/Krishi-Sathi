import React from "react";
import { AgriculturalAdvisory } from "../../../agentic/contracts/soil/advisoryTypes";

export interface AdvisoryHistoryProps {
  advisories: AgriculturalAdvisory[];
  onSelectAdvisory: (advisoryId: string) => void;
  selectedAdvisoryId?: string;
}

export const AdvisoryHistory: React.FC<AdvisoryHistoryProps> = ({
  advisories,
  onSelectAdvisory,
  selectedAdvisoryId,
}) => {
  if (advisories.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-lg border">
        No previous advisories recorded for this field.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
      <h3 className="text-sm font-bold text-slate-800 mb-2">📜 Advisory History</h3>
      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {advisories.map((adv) => {
          const isSelected = adv.id === selectedAdvisoryId;
          return (
            <div
              key={adv.id}
              onClick={() => onSelectAdvisory(adv.id)}
              className={`p-2.5 rounded-lg cursor-pointer transition flex justify-between items-center ${
                isSelected ? "bg-emerald-50 border border-emerald-200" : "hover:bg-slate-50"
              }`}
            >
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  {adv.cropName} ({adv.targetYieldQuintalsPerHa} q/ha)
                </span>
                <span className="text-3xs text-slate-500">
                  {new Date(adv.generatedAt).toLocaleDateString()} | v{adv.version}
                </span>
              </div>
              <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {adv.confidence.overallCompleteness}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
