import { randomUUID } from "crypto";
import { ValidatedFileUpload } from "./fileValidator";
import { NativePdfTextExtractor } from "./pdfExtractor";
import { ModelProvider } from "../providers/types";
import {
  SoilReportExtraction,
  ExtractedParameterCandidate,
  SoilReportLabMetadata,
} from "../contracts/soil/extractionTypes";
import { ValidationError } from "../contracts/errors";

export interface ExtractSoilReportOptions {
  fieldId: string;
  farmerId: string;
  modelProvider?: ModelProvider;
  signal?: AbortSignal;
}

export class SoilReportExtractor {
  private static readonly HA_TO_ACRE = 2.47105;

  /**
   * Ingests, parses, and normalizes a validated soil test report into structured candidates.
   * Produces an envelope in PENDING_APPROVAL status.
   */
  public static async extract(
    file: ValidatedFileUpload,
    options: ExtractSoilReportOptions
  ): Promise<SoilReportExtraction> {
    const reportId = `rep_${randomUUID()}`;
    const globalWarnings: string[] = [];
    let rawText = "";
    let effectiveFormat = file.format;
    let labMetadata: SoilReportLabMetadata = {};
    const candidates: Record<string, ExtractedParameterCandidate> = {};

    // 1. Digital PDF extraction vs Scanned / Image route
    if (file.format === "PDF_DIGITAL") {
      const pdfResult = NativePdfTextExtractor.extractText(file.buffer);
      globalWarnings.push(...pdfResult.warnings);

      if (pdfResult.isScannedOrImageOnly) {
        effectiveFormat = "PDF_SCANNED";
      } else {
        rawText = pdfResult.extractedText;
      }
    }

    // 2. Vision extraction for Scanned PDFs or Images
    if (effectiveFormat === "PDF_SCANNED" || effectiveFormat.startsWith("IMAGE_")) {
      if (!options.modelProvider || !options.modelProvider.extractVisionData) {
        globalWarnings.push(
          "Model provider does not support multimodal vision extraction. Falling back to heuristic text analysis."
        );
      } else {
        try {
          const visionPrompt = `Extract all laboratory soil test parameters, metadata, units, and test methods from this soil test report.
Return a clean JSON object with this exact shape:
{
  "labMetadata": {
    "labName": "Name of soil testing laboratory or institute",
    "sampleCode": "Sample ID or Soil Health Card number",
    "testingDate": "YYYY-MM-DD or date string",
    "farmerNameOnReport": "Farmer name if present",
    "district": "District",
    "state": "State"
  },
  "parameters": {
    "ph": { "value": 7.2, "unit": "pH_units", "testMethod": "SUSPENSION_1_2_5_WATER", "confidence": 0.95 },
    "electricalConductivity": { "value": 0.4, "unit": "dS/m", "testMethod": "SUSPENSION_1_2_WATER", "confidence": 0.90 },
    "organicCarbonPercent": { "value": 0.5, "unit": "%", "testMethod": "WALKLEY_BLACK_WET_OXIDATION", "confidence": 0.90 },
    "availableNitrogen": { "value": 280, "unit": "kg/ha", "testMethod": "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA", "confidence": 0.92 },
    "availablePhosphorus": { "value": 20, "unit": "kg/ha_P2O5", "testMethod": "OLSEN_SODIUM_BICARBONATE", "confidence": 0.90 },
    "availablePotassium": { "value": 180, "unit": "kg/ha_K2O", "testMethod": "NEUTRAL_NORMAL_AMMONIUM_ACETATE", "confidence": 0.92 },
    "availableSulphurPpm": { "value": 14, "unit": "ppm", "testMethod": "CALCIUM_CHLORIDE_TURBIDIMETRIC", "confidence": 0.85 },
    "availableZincPpm": { "value": 0.55, "unit": "ppm", "testMethod": "DTPA_TEA_CaCl2_LINDSAY_NORVELL", "confidence": 0.88 }
  }
}
DO NOT invent missing parameters. Only output parameters clearly legible on the document.`;

          const visionResponse = await options.modelProvider.extractVisionData({
            fileBase64: file.buffer.toString("base64"),
            mimeType: file.mimeType,
            prompt: visionPrompt,
            signal: options.signal,
          });

          const cleanJson = visionResponse.replace(/```json\s*|```\s*/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed.labMetadata) labMetadata = parsed.labMetadata;
          if (parsed.parameters && typeof parsed.parameters === "object") {
            for (const [key, p] of Object.entries(parsed.parameters)) {
              const param = p as any;
              if (param && typeof param.value === "number") {
                this.addCandidate(candidates, {
                  parameterKey: key,
                  rawKeyText: key,
                  rawValueText: String(param.value),
                  parsedNumericValue: param.value,
                  extractedUnit: param.unit,
                  extractedMethod: param.testMethod,
                  confidence: typeof param.confidence === "number" ? param.confidence : 0.85,
                  extractionWarnings: [],
                });
              }
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          globalWarnings.push(`Vision extraction failed or was unavailable: ${msg}`);
        }
      }
    }

    // 3. Digital text regex & structural extraction (runs on digital PDFs or extracted text)
    if (rawText && rawText.length > 0) {
      this.extractFromDigitalText(rawText, candidates, labMetadata, globalWarnings);
    }

    // 4. Compute overall confidence
    const candidateList = Object.values(candidates);
    const overallConfidence =
      candidateList.length > 0
        ? Math.round(
            (candidateList.reduce((acc, c) => acc + c.confidence, 0) / candidateList.length) * 100
          ) / 100
        : 0.0;

    if (candidateList.length === 0) {
      globalWarnings.push(
        "No standard soil parameters could be confidently extracted from this file. Manual entry or farmer review is required."
      );
    }

    return {
      id: reportId,
      fieldId: options.fieldId,
      farmerId: options.farmerId,
      sourceFileName: file.originalFileName,
      fileFormat: effectiveFormat,
      fileSizeBytes: file.sizeBytes,
      contentHash: file.contentHash,
      extractedAt: new Date().toISOString(),
      overallConfidence,
      globalExtractionWarnings: globalWarnings,
      labMetadata,
      candidates,
      rawExtractedText: rawText ? rawText.slice(0, 5000) : undefined,
      approvalProvenance: {
        status: "PENDING_APPROVAL",
        reviewerRole: "FARMER",
        editedFields: [],
      },
    };
  }

  /**
   * Rule-based extraction engine calibrated for Indian Soil Health Card (SHC) & state lab reports.
   */
  private static extractFromDigitalText(
    text: string,
    candidates: Record<string, ExtractedParameterCandidate>,
    labMetadata: SoilReportLabMetadata,
    warnings: string[]
  ): void {
    // 1. Lab metadata parsing
    const labMatch = text.match(/(?:Soil\s*Testing\s*Laboratory|KVK|Krishi\s*Vigyan\s*Kendra|Department\s*of\s*Agriculture)[^\n,.]*/i);
    if (labMatch) labMetadata.labName = labMatch[0].trim();

    const sampleMatch = text.match(/(?:Sample\s*(?:No|ID|Code)|SHC\s*No)[.:\s]*([A-Za-z0-9\-_/]+)/i);
    if (sampleMatch) labMetadata.sampleCode = sampleMatch[1].trim();

    const dateMatch = text.match(/(?:Date\s*of\s*(?:Testing|Analysis|Report|Sampling))[.:\s]*([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4})/i);
    if (dateMatch) labMetadata.testingDate = dateMatch[1].trim();

    // 2. pH extraction (0.0 to 14.0)
    const phMatch = text.match(/(?:pH|Soil\s*Reaction)\s*(?:[(]1:2(?:\.5)?[)])?[:\s=-]*([0-9]+(?:\.[0-9]+)?)/i);
    if (phMatch && !candidates.ph) {
      const val = parseFloat(phMatch[1]);
      if (val >= 0 && val <= 14) {
        this.addCandidate(candidates, {
          parameterKey: "ph",
          rawKeyText: "pH",
          rawValueText: phMatch[1],
          parsedNumericValue: val,
          extractedUnit: "pH_units",
          extractedMethod: "SUSPENSION_1_2_5_WATER",
          confidence: 0.95,
          extractionWarnings: [],
        });
      }
    }

    // 3. Electrical Conductivity (EC in dS/m or mmhos/cm)
    const ecMatch = text.match(/(?:Electrical\s*Conductivity|EC)\s*(?:[(]1:2[)])?[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(dS\/m|mmhos\/cm|mS\/cm)?/i);
    if (ecMatch && !candidates.electricalConductivity) {
      const val = parseFloat(ecMatch[1]);
      const rawUnit = ecMatch[2] || "dS/m";
      this.addCandidate(candidates, {
        parameterKey: "electricalConductivity",
        rawKeyText: "Electrical Conductivity (EC)",
        rawValueText: `${ecMatch[1]} ${rawUnit}`,
        parsedNumericValue: val,
        extractedUnit: rawUnit,
        extractedMethod: "SUSPENSION_1_2_WATER",
        confidence: 0.92,
        extractionWarnings: [],
      });
    }

    // 4. Organic Carbon (OC %)
    const ocMatch = text.match(/(?:Organic\s*Carbon|OC)\s*[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(%)?/i);
    if (ocMatch && !candidates.organicCarbonPercent) {
      const val = parseFloat(ocMatch[1]);
      this.addCandidate(candidates, {
        parameterKey: "organicCarbonPercent",
        rawKeyText: "Organic Carbon (OC)",
        rawValueText: `${ocMatch[1]} %`,
        parsedNumericValue: val,
        extractedUnit: "%",
        extractedMethod: "WALKLEY_BLACK_WET_OXIDATION",
        confidence: 0.94,
        extractionWarnings: [],
      });
    }

    // 5. Available Nitrogen (kg/ha or kg/acre)
    const nMatch = text.match(/(?:Available\s*(?:Nitrogen|N)|Nitrogen\s*[(]N[)])[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(kg\/ha|kg\/acre|ppm)?/i);
    if (nMatch && !candidates.availableNitrogen) {
      const val = parseFloat(nMatch[1]);
      const rawUnit = nMatch[2] || "kg/ha";
      this.addCandidate(candidates, {
        parameterKey: "availableNitrogen",
        rawKeyText: "Available Nitrogen (N)",
        rawValueText: `${nMatch[1]} ${rawUnit}`,
        parsedNumericValue: val,
        extractedUnit: rawUnit,
        extractedMethod: "ALKALINE_PERMANGANATE_SUBBIAH_ASIJA",
        confidence: 0.93,
        extractionWarnings: [],
      });
    }

    // 6. Available Phosphorus (Olsen vs Bray detection)
    const pMatch = text.match(
      /(?:Available\s*(?:Phosphorus|P)|Phosphorus\s*[(]P2O5|P[)])[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(kg\/ha_P2O5|kg\/ha_P|kg\/acre_P2O5|kg\/acre_P|kg\/ha|kg\/acre|ppm)?/i
    );
    if (pMatch && !candidates.availablePhosphorus) {
      const val = parseFloat(pMatch[1]);
      const rawUnit = pMatch[2] || "kg/ha_P2O5";
      const isBray = /bray/i.test(text);
      const method = isBray ? "BRAY_KURTZ_1_ACID_FLUORIDE" : "OLSEN_SODIUM_BICARBONATE";

      this.addCandidate(candidates, {
        parameterKey: "availablePhosphorus",
        rawKeyText: "Available Phosphorus",
        rawValueText: `${pMatch[1]} ${rawUnit}`,
        parsedNumericValue: val,
        extractedUnit: rawUnit,
        extractedMethod: method,
        confidence: 0.90,
        extractionWarnings: isBray ? ["Detected Bray acid-extractable method from document context."] : [],
      });
    }

    // 7. Available Potassium (kg/ha K2O)
    const kMatch = text.match(
      /(?:Available\s*(?:Potassium|Potash|K)|Potassium\s*[(]K2O|K[)])[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(kg\/ha_K2O|kg\/ha_K|kg\/acre_K2O|kg\/acre_K|kg\/ha|kg\/acre|ppm)?/i
    );
    if (kMatch && !candidates.availablePotassium) {
      const val = parseFloat(kMatch[1]);
      const rawUnit = kMatch[2] || "kg/ha_K2O";
      this.addCandidate(candidates, {
        parameterKey: "availablePotassium",
        rawKeyText: "Available Potassium (K2O)",
        rawValueText: `${kMatch[1]} ${rawUnit}`,
        parsedNumericValue: val,
        extractedUnit: rawUnit,
        extractedMethod: "NEUTRAL_NORMAL_AMMONIUM_ACETATE",
        confidence: 0.92,
        extractionWarnings: [],
      });
    }

    // 8. Available Sulphur (ppm or mg/kg)
    const sMatch = text.match(/(?:Available\s*Sulphur|Sulphur\s*[(]S[)])[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(ppm|mg\/kg|kg\/ha)?/i);
    if (sMatch && !candidates.availableSulphurPpm) {
      const val = parseFloat(sMatch[1]);
      const rawUnit = sMatch[2] || "ppm";
      this.addCandidate(candidates, {
        parameterKey: "availableSulphurPpm",
        rawKeyText: "Available Sulphur (S)",
        rawValueText: `${sMatch[1]} ${rawUnit}`,
        parsedNumericValue: val,
        extractedUnit: rawUnit,
        extractedMethod: "CALCIUM_CHLORIDE_TURBIDIMETRIC",
        confidence: 0.88,
        extractionWarnings: [],
      });
    }

    // 9. Zinc (ppm)
    const znMatch = text.match(/(?:Available\s*Zinc|Zinc\s*[(]Zn[)])[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(ppm|mg\/kg)?/i);
    if (znMatch && !candidates.availableZincPpm) {
      const val = parseFloat(znMatch[1]);
      const rawUnit = znMatch[2] || "ppm";
      this.addCandidate(candidates, {
        parameterKey: "availableZincPpm",
        rawKeyText: "Available Zinc (Zn)",
        rawValueText: `${znMatch[1]} ${rawUnit}`,
        parsedNumericValue: val,
        extractedUnit: rawUnit,
        extractedMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL",
        confidence: 0.90,
        extractionWarnings: [],
      });
    }

    // 10. Iron (ppm)
    const feMatch = text.match(/(?:Available\s*Iron|Iron\s*[(]Fe[)])[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(ppm|mg\/kg)?/i);
    if (feMatch && !candidates.availableIronPpm) {
      const val = parseFloat(feMatch[1]);
      this.addCandidate(candidates, {
        parameterKey: "availableIronPpm",
        rawKeyText: "Available Iron (Fe)",
        rawValueText: `${feMatch[1]} ppm`,
        parsedNumericValue: val,
        extractedUnit: "ppm",
        extractedMethod: "DTPA_TEA_CaCl2_LINDSAY_NORVELL",
        confidence: 0.88,
        extractionWarnings: [],
      });
    }

    // 11. Boron (ppm)
    const bMatch = text.match(/(?:Available\s*Boron|Boron\s*[(]B[)])[:\s=-]*([0-9]+(?:\.[0-9]+)?)\s*(ppm|mg\/kg)?/i);
    if (bMatch && !candidates.availableBoronPpm) {
      const val = parseFloat(bMatch[1]);
      this.addCandidate(candidates, {
        parameterKey: "availableBoronPpm",
        rawKeyText: "Available Boron (B)",
        rawValueText: `${bMatch[1]} ppm`,
        parsedNumericValue: val,
        extractedUnit: "ppm",
        extractedMethod: "HOT_WATER_AZOMETHINE_H",
        confidence: 0.86,
        extractionWarnings: [],
      });
    }
  }

  /**
   * Helper to normalize units into standard Phase 1 schemas.
   */
  private static addCandidate(
    target: Record<string, ExtractedParameterCandidate>,
    item: {
      parameterKey: string;
      rawKeyText: string;
      rawValueText: string;
      parsedNumericValue: number | null;
      extractedUnit?: string;
      extractedMethod?: string;
      confidence: number;
      extractionWarnings: string[];
    }
  ): void {
    let normalizedValue = item.parsedNumericValue;
    let normalizedUnit = item.extractedUnit;
    const warnings = [...item.extractionWarnings];

    if (item.parsedNumericValue !== null && item.extractedUnit) {
      const u = item.extractedUnit.toLowerCase();

      // Convert kg/acre to kg/ha
      if (u.includes("acre")) {
        normalizedValue = Math.round(item.parsedNumericValue * this.HA_TO_ACRE * 10) / 10;
        normalizedUnit = item.extractedUnit.replace(/acre/i, "ha");
        warnings.push(
          `Converted from ${item.extractedUnit} to ${normalizedUnit} (multiplying by 2.47105).`
        );
      }

      // Convert elemental P to P2O5
      if (item.parameterKey === "availablePhosphorus" && (u === "kg/ha_p" || u === "kg/acre_p")) {
        normalizedValue = Math.round(item.parsedNumericValue * 2.29 * 10) / 10;
        normalizedUnit = "kg/ha_P2O5";
        warnings.push("Converted elemental Phosphorus (P) to Phosphate (P2O5) using molecular factor 2.29.");
      }

      // Convert elemental K to K2O
      if (item.parameterKey === "availablePotassium" && (u === "kg/ha_k" || u === "kg/acre_k")) {
        normalizedValue = Math.round(item.parsedNumericValue * 1.20 * 10) / 10;
        normalizedUnit = "kg/ha_K2O";
        warnings.push("Converted elemental Potassium (K) to Potash (K2O) using molecular factor 1.20.");
      }
    }

    if (item.confidence < 0.75) {
      warnings.push("Low extraction confidence: Farmer manual verification recommended.");
    }

    target[item.parameterKey] = {
      parameterKey: item.parameterKey,
      rawKeyText: item.rawKeyText,
      rawValueText: item.rawValueText,
      parsedNumericValue: item.parsedNumericValue,
      extractedUnit: item.extractedUnit,
      extractedMethod: item.extractedMethod,
      normalizedValue,
      normalizedUnit,
      confidence: item.confidence,
      extractionWarnings: warnings,
    };
  }
}
