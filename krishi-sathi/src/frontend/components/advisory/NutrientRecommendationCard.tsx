import React from "react";
import { AdvisoryNutrientManagement } from "../../../agentic/contracts/soil/advisoryTypes";

export interface NutrientRecommendationCardProps {
  nutrientManagement: AdvisoryNutrientManagement;
  methodology: string;
}

export const NutrientRecommendationCard: React.FC<NutrientRecommendationCardProps> = ({
  nutrientManagement,
  methodology,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          🌱 Deterministic Nutrient & Fertilizer Plan
        </h2>
        <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-1 rounded">
          {methodology}
        </span>
      </div>

      {/* Net Elemental/Oxide Requirements */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-4">
        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block mb-2">
          Net Nutrient Requirements (Authoritative)
        </span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white p-2 rounded border border-emerald-100 shadow-2xs">
            <span className="text-xs text-slate-500 block">Nitrogen (N)</span>
            <span className="text-base font-bold text-slate-800">
              {nutrientManagement.protectedNetNutrientRequirement.n} <span className="text-xs font-normal">kg/ha</span>
            </span>
          </div>
          <div className="bg-white p-2 rounded border border-emerald-100 shadow-2xs">
            <span className="text-xs text-slate-500 block">Phosphorus (P₂O₅)</span>
            <span className="text-base font-bold text-slate-800">
              {nutrientManagement.protectedNetNutrientRequirement.p2o5} <span className="text-xs font-normal">kg/ha</span>
            </span>
          </div>
          <div className="bg-white p-2 rounded border border-emerald-100 shadow-2xs">
            <span className="text-xs text-slate-500 block">Potassium (K₂O)</span>
            <span className="text-base font-bold text-slate-800">
              {nutrientManagement.protectedNetNutrientRequirement.k2o} <span className="text-xs font-normal">kg/ha</span>
            </span>
          </div>
        </div>
      </div>

      {/* Commercial Fertilizer Products Formulations */}
      <div>
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
          Recommended Commercial Fertilizer Products
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {nutrientManagement.protectedFertilizerDoses.map((f, idx) => (
            <div key={idx} className="p-3 border rounded-lg bg-slate-50 flex justify-between items-center">
              <div>
                <span className="font-semibold text-sm text-slate-800 block">{f.commercialName}</span>
                <span className="text-xs text-slate-500">Product code: {f.productCode}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-900 text-sm">{f.quantityKgPerHa} kg/ha</span>
                <span className="text-xs text-slate-500 block">({f.quantityKgPerAcre} kg/acre)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Explanations */}
      <div className="space-y-2 pt-2 border-t text-xs text-slate-600">
        <p>
          <strong className="text-slate-700">Strategy:</strong> {nutrientManagement.npkStrategyExplanation}
        </p>
        <p>
          <strong className="text-slate-700">Formulation:</strong> {nutrientManagement.recommendedProductsExplanation}
        </p>
        {nutrientManagement.organicManureNotes && (
          <p className="text-emerald-700 font-medium bg-emerald-50/50 p-2 rounded">
            🌾 {nutrientManagement.organicManureNotes}
          </p>
        )}
      </div>
    </div>
  );
};
