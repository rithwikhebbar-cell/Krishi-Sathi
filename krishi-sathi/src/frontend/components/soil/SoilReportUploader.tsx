import React, { useState, useRef } from "react";

export interface SoilReportUploaderProps {
  fieldId: string;
  onUploadSuccess: (reportId: string, extractionData: any) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export const SoilReportUploader: React.FC<SoilReportUploaderProps> = ({
  fieldId,
  onUploadSuccess,
  onError,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    // Client-side pre-validation
    const allowedExtensions = /\.(pdf|png|jpe?g|webp)$/i;
    if (!allowedExtensions.test(file.name)) {
      const msg = "Invalid file type. Only PDF documents and image files (PNG, JPG, WebP) are supported.";
      onError?.(msg);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      const msg = "File size exceeds maximum allowed limit of 10 MB.";
      onError?.(msg);
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Processing ${file.name}...`);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Content = (reader.result as string).split(",")[1];
          const response = await fetch(`/api/fields/${encodeURIComponent(fieldId)}/soil-reports/upload`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: file.name,
              fileBase64: base64Content,
              mimeType: file.type || "application/pdf",
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || data.error || "Failed to upload soil report.");
          }

          onUploadSuccess(data.reportId, data.extraction);
        } catch (err: any) {
          onError?.(err.message || "Failed to process upload.");
        } finally {
          setIsUploading(false);
          setUploadProgress("");
        }
      };

      reader.onerror = () => {
        setIsUploading(false);
        onError?.("Failed to read local file.");
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploading(false);
      onError?.(err.message || "File upload failed.");
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {isUploading ? uploadProgress : "Upload Soil Test Report"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports Digital PDFs, Scanned Reports, PNG and JPG images (up to 10 MB)
            </p>
          </div>

          {isUploading && (
            <div className="w-48 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-emerald-600 h-1.5 rounded-full animate-pulse w-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
