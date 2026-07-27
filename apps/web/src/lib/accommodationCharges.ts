export interface AccommodationTaxLine {
  key: "GST" | "PST";
  label: string;
  rate: number;
  amount: number;
}

export interface AccommodationCharges {
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxInclusive: boolean;
  taxBreakdown: AccommodationTaxLine[];
}

function percentage(settings: Record<string, unknown>, key: string): number {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

export function calculateAccommodationCharges(
  enteredAmount: number,
  settings: Record<string, unknown>,
): AccommodationCharges {
  const amount = Math.max(0, Math.round(enteredAmount));
  const taxes = [
    ...(settings.gstEnabled === true && percentage(settings, "gstRate") > 0
      ? [{ key: "GST" as const, label: "GST", rate: percentage(settings, "gstRate") }]
      : []),
    ...(settings.pstEnabled === true && percentage(settings, "pstRate") > 0
      ? [{ key: "PST" as const, label: "PST / PRA", rate: percentage(settings, "pstRate") }]
      : []),
  ];
  const taxInclusive = settings.taxInclusive === true;
  const combinedRate = taxes.reduce((sum, tax) => sum + tax.rate, 0);

  if (taxes.length === 0 || combinedRate === 0) {
    return {
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
    subtotalAmount: amount - taxAmount,
    taxAmount,
    totalAmount: amount,
    taxInclusive: true,
    taxBreakdown,
  };
}
