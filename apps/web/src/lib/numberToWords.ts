const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? ` ${ONES[ones]}` : "");
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

// Indian/Pakistani numbering (thousand, lakh, crore) — matches how PKR amounts are normally spoken.
function numberToWords(n: number): string {
  if (n === 0) return "zero";
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  const rest = n;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/** Renders a PKR rupee amount (not paisas) as words, e.g. 5000 -> "Five thousand rupees". */
export function pkrInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const words = numberToWords(Math.round(amount));
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupee${Math.round(amount) === 1 ? "" : "s"}`;
}
