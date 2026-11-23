import { createHash, randomUUID } from "crypto";
import { ReportSourceFormat } from "../contracts/soil/extractionTypes";
import { ValidationError } from "../contracts/errors";

export interface ValidatedFileUpload {
  internalFileId: string;
  originalFileName: string;
  sanitizedFileName: string;
  format: ReportSourceFormat;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  buffer: Buffer;
}

export interface FileValidatorOptions {
  maxFileSizeBytes?: number; // Default 10 MB
}

export class FileValidator {
  private static readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Validates uploaded soil test report files using strict magic-byte signatures and MIME classification.
   * Defends against path traversal, MIME-spoofing, and executable payloads.
   */
  public static validate(
    buffer: Buffer,
    fileName: string,
    claimedMimeType?: string,
    options: FileValidatorOptions = {}
  ): ValidatedFileUpload {
    const maxSize = options.maxFileSizeBytes || this.DEFAULT_MAX_SIZE;

    // 1. File size check
    if (!buffer || buffer.length === 0) {
      throw new ValidationError("Uploaded file is empty (0 bytes).");
    }

    if (buffer.length > maxSize) {
      throw new ValidationError(
        `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds allowed limit of ${(maxSize / (1024 * 1024)).toFixed(0)} MB.`
      );
    }

    // 2. Magic byte / signature inspection (never trust client MIME type or extension alone)
    const detected = this.detectSignature(buffer);
    if (!detected) {
      throw new ValidationError(
        "Invalid file signature. Only standard PDF documents (%PDF) and images (PNG, JPEG, WebP) are accepted."
      );
    }

    // 3. Sanitized filename to prevent path traversal
    const baseName = fileName.replace(/^.*[\\\/]/, "").trim();
    const sanitizedFileName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_") || "soil_report";

    // 4. Cryptographic SHA-256 content hash
    const contentHash = createHash("sha256").update(buffer).digest("hex");
    const internalFileId = `file_${randomUUID()}`;

    return {
      internalFileId,
      originalFileName: baseName,
      sanitizedFileName,
      format: detected.format,
      mimeType: detected.mimeType,
      sizeBytes: buffer.length,
      contentHash,
      buffer,
    };
  }

  private static detectSignature(buffer: Buffer): { format: ReportSourceFormat; mimeType: string } | null {
    if (buffer.length < 4) return null;

    // PDF Magic Bytes: %PDF (0x25, 0x50, 0x44, 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { format: "PDF_DIGITAL", mimeType: "application/pdf" };
    }

    // PNG Magic Bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    ) {
      return { format: "IMAGE_PNG", mimeType: "image/png" };
    }

    // JPEG Magic Bytes: 0xFF, 0xD8, 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { format: "IMAGE_JPEG", mimeType: "image/jpeg" };
    }

    // WebP Magic Bytes: RIFF....WEBP (0x52, 0x49, 0x46, 0x46 .... 0x57, 0x45, 0x42, 0x50)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { format: "IMAGE_WEBP", mimeType: "image/webp" };
    }

    return null;
  }
}
