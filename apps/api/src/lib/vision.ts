// Vision API abstraction.
// V1: Google Vision REST API + API key. Future: swap for Claude Vision (Anthropic SDK).
// Claude advantage: returns structured JSON directly — no fuzzy matching needed.

import { env } from "./env";
import { AppError } from "../utils/AppError";

export interface VisionResult {
  texts: string[];   // OCR-extracted strings
  labels: string[];  // general object/scene labels
  provider: "google-vision" | "claude";
}

export interface VisionProvider {
  analyze(imageUrl: string): Promise<VisionResult>;
}

// ── Google Vision (REST + API key) ────────────────────────────────────────────

interface GoogleAnnotateResponse {
  responses: Array<{
    textAnnotations?:    Array<{ description: string }>;
    fullTextAnnotation?: { text: string };
    labelAnnotations?:   Array<{ description: string; score: number }>;
    error?:              { code: number; message: string };
  }>;
}

class GoogleVisionProvider implements VisionProvider {
  private readonly apiKey = env.GOOGLE_VISION_API_KEY!;

  async analyze(imageUrl: string): Promise<VisionResult> {
    const body = {
      requests: [
        {
          image:    { source: { imageUri: imageUrl } },
          features: [
            { type: "TEXT_DETECTION",  maxResults: 50 },
            { type: "LABEL_DETECTION", maxResults: 20 },
          ],
        },
      ],
    };

    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const raw = await res.text();
      throw new AppError(502, `Google Vision API error: ${raw}`);
    }

    const data = (await res.json()) as GoogleAnnotateResponse;
    const resp = data.responses?.[0];

    if (resp?.error) {
      throw new AppError(502, `Google Vision error: ${resp.error.message}`);
    }

    // fullTextAnnotation.text is the whole block; split into non-trivial lines.
    const rawText = resp?.fullTextAnnotation?.text ?? "";
    const fromBlock = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 2);

    // Individual annotations (skip index 0 — it's the same full block).
    const fromAnnotations = (resp?.textAnnotations ?? [])
      .slice(1)
      .map((a) => a.description.trim())
      .filter((t) => t.length > 2);

    const texts = [...new Set([...fromBlock, ...fromAnnotations])];

    const labels = (resp?.labelAnnotations ?? [])
      .filter((l) => l.score > 0.7)
      .map((l) => l.description);

    return { texts, labels, provider: "google-vision" };
  }
}

// ── Claude Vision (future) ────────────────────────────────────────────────────
// class ClaudeVisionProvider implements VisionProvider {
//   async analyze(imageUrl: string): Promise<VisionResult> {
//     // Use @anthropic-ai/sdk. Prompt it to return structured JSON:
//     // { items: [{ name, quantity, unit }] }
//     // Then skip fuzzy matching entirely — use the structured output directly.
//     throw new Error("Claude Vision provider not yet implemented");
//   }
// }

// ── Factory ───────────────────────────────────────────────────────────────────

function createVisionProvider(): VisionProvider {
  if (!env.GOOGLE_VISION_API_KEY) {
    throw new AppError(
      503,
      "Vision API is not configured. Set GOOGLE_VISION_API_KEY in your .env file.",
    );
  }
  return new GoogleVisionProvider();
}

let _visionProvider: VisionProvider | null = null;

export function getVisionProvider(): VisionProvider {
  if (!_visionProvider) _visionProvider = createVisionProvider();
  return _visionProvider;
}
