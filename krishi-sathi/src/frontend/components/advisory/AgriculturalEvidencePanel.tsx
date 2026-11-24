import React from "react";
import { AdvisorySourceReference } from "../../../agentic/contracts/soil/advisoryTypes";

export interface AgriculturalEvidencePanelProps {
  supportingSources: AdvisorySourceReference[];
}

export const AgriculturalEvidencePanel: React.FC<AgriculturalEvidencePanelProps> = ({ supportingSources }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        📚 Verified Scientific Sources
      </h3>
      <div className="space-y-2">
        {supportingSources.map((src, idx) => (
          <div key={idx} className="p-2.5 bg-slate-50 border rounded-lg text-xs space-y-1">
            <div className="flex justify-between items-start">
              <span className="font-semibold text-slate-800 line-clamp-1">{src.title}</span>
              <span className="text-3xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0 ml-1">
                ICAR / SAU
              </span>
            </div>
            <p className="text-3xs text-slate-500">{src.publisherOrInstitution}</p>
            {src.relevanceNote && <p className="text-3xs text-slate-600 italic">{src.relevanceNote}</p>}
            {src.url && (
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="text-3xs text-emerald-600 hover:underline block pt-0.5"
              >
                🔗 View Publication
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
