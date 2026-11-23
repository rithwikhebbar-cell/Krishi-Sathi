import React, { useState } from "react";

export interface SoilReportApprovalActionsProps {
  reportId: string;
  isSubmitting?: boolean;
  onApprove: (notes?: string) => void;
  onReject: (rejectionReason: string, notes?: string) => void;
}

export const SoilReportApprovalActions: React.FC<SoilReportApprovalActionsProps> = ({
  reportId,
  isSubmitting = false,
  onApprove,
  onReject,
}) => {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(rejectionReason.trim());
    setShowRejectModal(false);
  };

  const handleConfirmApprove = () => {
    onApprove(approvalNotes.trim() || undefined);
    setShowApproveConfirm(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Mandatory Farmer Approval Required
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Extracted data will not become the active soil profile until you explicitly verify and sign off.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setShowRejectModal(true)}
            className="px-4 py-2 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Reject Report
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setShowApproveConfirm(true)}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
          >
            <span>Approve & Activate Profile</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Approval */}
      {showApproveConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 text-xs">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Confirm Soil Report Approval
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              By approving, this report's parameters will become the authoritative active soil profile for your field, and an immutable historical record will be stored.
            </p>

            <div className="mb-4">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Optional Farmer Notes:
              </label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Verified with physical laboratory card received today"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowApproveConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Rejection */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 text-xs">
            <h3 className="text-base font-semibold text-rose-700 dark:text-rose-400 mb-2">
              Reject Soil Report
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Please specify why this extracted report is being rejected. Your field's active soil profile will remain unchanged.
            </p>

            <div className="mb-4">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Rejection Reason (Required):
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Scanned document too blurry; parameters misaligned with physical card."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium disabled:opacity-50"
              >
                Reject Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
