import type { ThemeKey } from "@/services/settings";

export interface ThemeDefinition {
  key: ThemeKey;
  label: string;
  swatch: string;
}

// Swatch shown in the palette picker — matches each theme's accent color.
export const THEMES: ThemeDefinition[] = [
  { key: "WARM_CLAY",    label: "Warm Clay",    swatch: "#E0532B" },
  { key: "PINE_TEAL",    label: "Pine Teal",    swatch: "#0E7C72" },
  { key: "AZURE_SLATE",  label: "Azure Slate",  swatch: "#3D5A73" },
  { key: "INDIGO_NIGHT", label: "Indigo Night", swatch: "#4B53C9" },
];

const DEFAULT_THEME: ThemeKey = "WARM_CLAY";

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && THEMES.some((t) => t.key === value);
}

// Applies the theme by setting a data-theme attribute on <html> — CSS variables
// in index.css key off this attribute to repaint every page instantly.
export function applyTheme(themeKey: unknown): void {
  const key = isThemeKey(themeKey) ? themeKey : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", key);
}
