import type { TenantTx } from "@pms/db";
import { adminPrisma } from "@pms/db";
import { getStorageProvider } from "../lib/storage";
import { getVisionProvider } from "../lib/vision";
import type { ScanInventoryDto } from "../schemas/inventoryScan";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export interface ScanMatch {
  item: {
    id:           string;
    name:         string;
    category:     string;
    unit:         string;
    currentStock: number;
    sku:          string | null;
  };
  matchedText: string;
  confidence:  number; // 0–1
  suggestedQty: number | null;
}

export interface ScanResult {
  imageUrl:      string;
  detectedTexts: string[];
  matches:       ScanMatch[];
}

export const InventoryScanService = {
  // Used by the authenticated desktop upload route (POST /api/inventory/scan)
  async scan(
    withTenant: WithTenantFn,
    hotelId: string,
    dto: ScanInventoryDto,
  ): Promise<ScanResult> {
    const fetchItems = () => withTenant((db) =>
      db.inventoryItem.findMany({
        where:  { hotelId, isActive: true },
        select: { id: true, name: true, sku: true, category: true, unit: true, currentStock: true },
      })
    );
    return runScan(hotelId, dto, fetchItems);
  },

  // Used by the mobile upload route (POST /api/m/scan/:token) — no JWT, token = auth
  async scanForSession(hotelId: string, dto: ScanInventoryDto): Promise<ScanResult> {
    const fetchItems = () => adminPrisma.inventoryItem.findMany({
      where:  { hotelId, isActive: true },
      select: { id: true, name: true, sku: true, category: true, unit: true, currentStock: true },
    });
    return runScan(hotelId, dto, fetchItems);
  },
};

async function runScan(
  hotelId: string,
  dto: ScanInventoryDto,
  fetchItems: () => Promise<Array<{ id: string; name: string; sku: string | null; category: string; unit: string; currentStock: unknown }>>,
): Promise<ScanResult> {
  const storage = getStorageProvider();
  const vision  = getVisionProvider();

  const uploaded     = await storage.upload(dto.imageBase64, dto.mimeType, `inventory/${hotelId}`);
  const visionResult = await vision.analyze(uploaded.url);

  const rawItems = await fetchItems();
  const items    = rawItems.map((i) => ({
    ...i,
    currentStock: parseFloat(String(i.currentStock)),
  }));

  const matches = matchTextsToItems(visionResult.texts, items);

  return {
    imageUrl:      uploaded.url,
    detectedTexts: visionResult.texts.slice(0, 40),
    matches,
  };
}

// ── Matching ──────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

interface ItemLike {
  id:           string;
  name:         string;
  sku:          string | null;
  category:     string;
  unit:         string;
  currentStock: number;
}

function scoreMatch(normText: string, normName: string, normSku: string | null): number {
  if (!normText || normText.length < 2) return 0;

  if (normText === normName)                                       return 1.0;
  if (normName.includes(normText) && normText.length >= 3)        return (normText.length / normName.length) * 0.9;
  if (normText.includes(normName) && normName.length >= 3)        return (normName.length / normText.length) * 0.85;
  if (normSku && normText.includes(normSku) && normSku.length >= 2) return 0.8;

  return 0;
}

function matchTextsToItems(texts: string[], items: ItemLike[]): ScanMatch[] {
  const seen:    Set<string>  = new Set();
  const matches: ScanMatch[]  = [];

  for (const item of items) {
    const normName = normalize(item.name);
    const normSku  = item.sku ? normalize(item.sku) : null;

    let bestText  = "";
    let bestScore = 0;

    for (const text of texts) {
      const normText = normalize(text);
      const score    = scoreMatch(normText, normName, normSku);
      if (score > bestScore) { bestScore = score; bestText = text; }
    }

    if (bestScore >= 0.4 && !seen.has(item.id)) {
      seen.add(item.id);
      matches.push({
        item: {
          id:           item.id,
          name:         item.name,
          category:     item.category,
          unit:         item.unit,
          currentStock: item.currentStock,
          sku:          item.sku,
        },
        matchedText:  bestText,
        confidence:   bestScore,
        suggestedQty: extractQuantityNearText(texts, bestText),
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

// Try to find a number near the matched text, e.g. "rice 24 bags" → 24
function extractQuantityNearText(texts: string[], _matchedText: string): number | null {
  const combined = texts.join(" ");
  // Match a standalone integer or decimal that looks like a count/quantity
  const m = combined.match(/\b(\d{1,5}(?:\.\d{1,3})?)\s*(?:x|pcs?|pieces?|units?|kg|g|l(?:tr)?|ml|boxes?|bags?|cans?|bottles?|pkts?|packets?|cartons?)\b/i);
  if (m) {
    const n = parseFloat(m[1]);
    if (n > 0 && n <= 9999) return n;
  }
  return null;
}
