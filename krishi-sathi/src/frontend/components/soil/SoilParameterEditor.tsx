import React, { useState } from "react";
import { ExtractedParameterCandidate } from "../../../agentic/contracts/soil/extractionTypes";

export interface SoilParameterEditorProps {
  paramKey: string;
  candidate: ExtractedParameterCandidate;
  onSave: (correction: { value: number; unit?: string; method?: string; reason?: string }) => void;
  onClose: () => void;
}

export const SoilParameterEditor: React.FC<SoilParameterEditorProps> = ({
  paramKey,
  candidate,
  onSave,
  onClose,
}) => {
  const [value, setValue] = useState<number>(
    candidate.farmerCorrection?.correctedValue ?? (candidate.normalizedValue || 0)
  );
  const [unit, setUnit] = useState<string>(
    candidate.farmerCorrection?.correctedUnit ?? (candidate.normalizedUnit || "")
  );
  const [method, setMethod] = useState<string>(
    candidate.farmerCorrection?.correctedMethod ?? (candidate.extractedMethod || "")
  );
  const [reason, setReason] = useState<string>(
    candidate.farmerCorrection?.reason ?? ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      value: Number(value),
      unit: unit.trim() || undefined,
      method: method.trim() || undefined,
      reason: reason.trim() || "Manual correction by farmer",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Edit Parameter: {candidate.rawKeyText}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs mb-4 space-y-1">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Original Extracted:</span> {candidate.rawValueText || "None"}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Confidence Score:</span> {Math.round(candidate.confidence * 100)}%
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Corrected Value
            </label>
            <input
              type="number"
              step="any"
              required
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Measurement Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. kg/ha, ppm, %"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Analytical Method
            </label>
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. OLSEN_SODIUM_BICARBONATE, WALKLEY_BLACK"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason for Correction
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this value was adjusted..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
            >
              Apply Correction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
