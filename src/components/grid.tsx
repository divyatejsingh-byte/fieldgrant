"use client";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColumnState } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";
import { useCallback, type RefObject } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

/** One look for every grid in the app: flat, hairline borders, readable 13px text. The surrounding panel owns the outer border. */
export const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 12,
  headerFontSize: 10,
  headerFontFamily: "var(--font-mono), ui-monospace, monospace",
  headerFontWeight: 600,
  headerTextColor: "#71717a",
  headerBackgroundColor: "#fafafa",
  backgroundColor: "#ffffff",
  foregroundColor: "#18181b",
  borderColor: "#e4e4e7",
  rowBorder: { color: "#f4f4f5" },
  headerRowBorder: { color: "#e4e4e7" },
  columnBorder: false,
  valueChangeValueHighlightBackgroundColor: "#a7f3d0", // cells flash emerald when polling changes a status
  rowHoverColor: "rgba(250,250,250,0.8)",
  selectedRowBackgroundColor: "#ecfdf5",
  rowHeight: 40,
  headerHeight: 36,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  spacing: 6,
  accentColor: "#059669",
});

/** Cents -> "$1,234.50" for AG Grid value formatters (money is always integer cents in the data). */
export const centsFormatter = (p: { value: number | null | undefined }) =>
  p.value == null ? "" : (p.value / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Remembers each viewer's column order, widths, sort and visibility per grid, so the grid they tuned is the grid they get back.
 * Stored in localStorage only (presentation, never data); every access is guarded because storage can be unavailable.
 */
export function useSavedLayout<T>(key: string, grid: RefObject<AgGridReact<T> | null>) {
  const storageKey = `fg.grid.${key}`;
  const restore = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) grid.current?.api.applyColumnState({ state: JSON.parse(raw) as ColumnState[], applyOrder: true });
    } catch { /* ignore a corrupt or unavailable layout */ }
  }, [grid, storageKey]);
  const save = useCallback(() => {
    try { const s = grid.current?.api.getColumnState(); if (s) localStorage.setItem(storageKey, JSON.stringify(s)); } catch { /* storage unavailable */ }
  }, [grid, storageKey]);
  const reset = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* storage unavailable */ }
    grid.current?.api.resetColumnState();
    grid.current?.api.setFilterModel(null);
  }, [grid, storageKey]);
  return { restore, save, reset };
}
