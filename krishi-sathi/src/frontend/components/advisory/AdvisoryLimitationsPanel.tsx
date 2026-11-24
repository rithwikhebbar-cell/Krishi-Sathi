import React from "react";
import { AdvisoryEvidenceAndLimitations } from "../../../agentic/contracts/soil/advisoryTypes";

export interface AdvisoryLimitationsPanelProps {
  evidenceAndLimitations: AdvisoryEvidenceAndLimitations;
  unsupportedParameters?: string[];
}

export const AdvisoryLimitationsPanel: React.FC<AdvisoryLimitationsPanelProps> = ({
  evidenceAndLimitations,
  unsupportedParameters = [],
}) => {
  const hasLimitations =
    evidenceAndLimitations.knownLimitations.length > 0 ||
    evidenceAndLimitations.missingInformation.length > 0 ||
    unsupportedParameters.length > 0;

  if (!hasLimitations) return null;

  return (
    <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-5 space-y-3">
      <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
        ⚠️ Agronomic Boundaries & Limitations
      </h3>

      {unsupportedParameters.length > 0 && (
        <div>
          <span className="text-3xs font-bold text-rose-700 uppercase tracking-wider block mb-1">
            Unsupported / Missing Parameters
          </span>
          <p className="text-xs text-rose-800">
            {unsupportedParameters.join(", ")} could not be validated by regional STCR models.
          </p>
        </div>
      )}

      {evidenceAndLimitations.missingInformation.length > 0 && (
        <div>
          <span className="text-3xs font-bold text-amber-800 uppercase tracking-wider block mb-1">
            Missing Laboratory Tests
          </span>
          <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
            {evidenceAndLimitations.missingInformation.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {evidenceAndLimitations.knownLimitations.length > 0 && (
        <div>
          <span className="text-3xs font-bold text-amber-800 uppercase tracking-wider block mb-1">
            Engine & Evidence Assumptions
          </span>
          <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
            {evidenceAndLimitations.knownLimitations.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
