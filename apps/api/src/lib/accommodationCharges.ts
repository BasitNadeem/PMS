export interface AccommodationTaxLine {
  key: "GST" | "PST";
  label: string;
  rate: number;
  amount: number;
}

export interface AccommodationCharges {
  enteredAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxInclusive: boolean;
  taxBreakdown: AccommodationTaxLine[];
}

interface ActiveTax {
  key: AccommodationTaxLine["key"];
  label: string;
  rate: number;
}

function percentage(settings: Record<string, unknown>, key: string): number {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

export function getActiveAccommodationTaxes(settings: Record<string, unknown>): ActiveTax[] {
  const taxes: ActiveTax[] = [];
  if (settings.gstEnabled === true) {
    const rate = percentage(settings, "gstRate");
    if (rate > 0) taxes.push({ key: "GST", label: "GST", rate });
  }
  if (settings.pstEnabled === true) {
    const rate = percentage(settings, "pstRate");
    if (rate > 0) taxes.push({ key: "PST", label: "PST / PRA", rate });
  }
  return taxes;
}

export function calculateAccommodationCharges(
  enteredAmount: number,
  settings: Record<string, unknown>,
): AccommodationCharges {
  const amount = Math.max(0, Math.round(enteredAmount));
  const taxes = getActiveAccommodationTaxes(settings);
  const taxInclusive = settings.taxInclusive === true;
  const combinedRate = taxes.reduce((sum, tax) => sum + tax.rate, 0);

  if (taxes.length === 0 || combinedRate === 0) {
    return {
      enteredAmount: amount,
      subtotalAmount: amount,
      taxAmount: 0,
      totalAmount: amount,
      taxInclusive,
      taxBreakdown: [],
    };
  }

  if (!taxInclusive) {
    const taxBreakdown = taxes.map((tax) => ({
      ...tax,
      amount: Math.round(amount * tax.rate / 100),
    }));
    const taxAmount = taxBreakdown.reduce((sum, tax) => sum + tax.amount, 0);
    return {
      enteredAmount: amount,
      subtotalAmount: amount,
      taxAmount,
      totalAmount: amount + taxAmount,
      taxInclusive: false,
      taxBreakdown,
    };
  }

  const taxAmount = Math.round(amount * combinedRate / (100 + combinedRate));
  let allocated = 0;
  const taxBreakdown = taxes.map((tax, index) => {
    const componentAmount = index === taxes.length - 1
      ? taxAmount - allocated
      : Math.round(taxAmount * tax.rate / combinedRate);
    allocated += componentAmount;
    return { ...tax, amount: componentAmount };
  });

  return {
    enteredAmount: amount,
    subtotalAmount: amount - taxAmount,
    taxAmount,
    totalAmount: amount,
    taxInclusive: true,
    taxBreakdown,
  };
}

export function parseAccommodationTaxBreakdown(value: unknown): AccommodationTaxLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const candidate = line as Record<string, unknown>;
    if (
      (candidate.key !== "GST" && candidate.key !== "PST") ||
      typeof candidate.label !== "string" ||
      typeof candidate.rate !== "number" ||
      typeof candidate.amount !== "number"
    ) {
      return [];
    }
    return [{
      key: candidate.key,
      label: candidate.label,
      rate: candidate.rate,
      amount: Math.round(candidate.amount),
    }];
  });
}
