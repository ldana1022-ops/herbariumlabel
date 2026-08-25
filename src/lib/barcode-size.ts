import { useCallback, useEffect, useState } from "react";

export type BarcodeUnit = "mm" | "cm";

export type BarcodeSize = {
  /** rendered width in `unit` */
  width: number;
  /** bar height in `unit` */
  height: number;
  /** measurement unit for width/height */
  unit: BarcodeUnit;
};

export type SavedBarcodeSize = BarcodeSize & { id: string; name: string };

export const barcodeToMm = (value: number, unit: BarcodeUnit) =>
  unit === "cm" ? value * 10 : value;

export const BARCODE_PRESETS: { id: string; label: string; size: BarcodeSize }[] = [
  { id: "small", label: "Small — 35 × 10 mm", size: { width: 35, height: 10, unit: "mm" } },
  { id: "medium", label: "Medium — 50 × 14 mm", size: { width: 50, height: 14, unit: "mm" } },
  { id: "large", label: "Large — 70 × 20 mm", size: { width: 70, height: 20, unit: "mm" } },
];

export const DEFAULT_BARCODE_SIZE: BarcodeSize = { width: 50, height: 14, unit: "mm" };

export const BARCODE_LIMITS = { minW: 20, maxW: 160, minH: 6, maxH: 40 };

/** Clamp against the mm limits while preserving the chosen unit. */
export const clampBarcodeSize = (s: BarcodeSize): BarcodeSize => {
  const unit: BarcodeUnit = s.unit === "cm" ? "cm" : "mm";
  const factor = unit === "cm" ? 10 : 1;
  const wMm = Math.min(BARCODE_LIMITS.maxW, Math.max(BARCODE_LIMITS.minW, (s.width || 1) * factor));
  const hMm = Math.min(
    BARCODE_LIMITS.maxH,
    Math.max(BARCODE_LIMITS.minH, (s.height || 1) * factor),
  );
  return {
    unit,
    width: Number((wMm / factor).toFixed(2)),
    height: Number((hMm / factor).toFixed(2)),
  };
};

const SIZE_KEY = "ncvc-barcode-size";
const SAVED_KEY = "ncvc-barcode-saved-sizes";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useBarcodeSize() {
  const [size, setSizeState] = useState<BarcodeSize>(DEFAULT_BARCODE_SIZE);
  const [saved, setSavedState] = useState<SavedBarcodeSize[]>([]);

  useEffect(() => {
    setSizeState(clampBarcodeSize(read(SIZE_KEY, DEFAULT_BARCODE_SIZE)));
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedState(
            (parsed as SavedBarcodeSize[]).map((s) => ({
              ...s,
              unit: s.unit === "cm" ? "cm" : "mm",
            })),
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setSize = useCallback((next: BarcodeSize) => {
    const clamped = clampBarcodeSize(next);
    setSizeState(clamped);
    try {
      window.localStorage.setItem(SIZE_KEY, JSON.stringify(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const persistSaved = useCallback((list: SavedBarcodeSize[]) => {
    setSavedState(list);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }, []);

  const saveSize = useCallback(
    (name: string, value: BarcodeSize) => {
      const entry: SavedBarcodeSize = {
        id: `${Date.now()}`,
        name: name.trim() || "Custom",
        ...clampBarcodeSize(value),
      };
      persistSaved([...saved, entry]);
      return entry;
    },
    [saved, persistSaved],
  );

  const updateSaved = useCallback(
    (id: string, patch: Partial<SavedBarcodeSize>) => {
      persistSaved(
        saved.map((s) =>
          s.id === id ? { ...s, ...patch, ...clampBarcodeSize({ ...s, ...patch }) } : s,
        ),
      );
    },
    [saved, persistSaved],
  );

  const removeSaved = useCallback(
    (id: string) => persistSaved(saved.filter((s) => s.id !== id)),
    [saved, persistSaved],
  );

  return { size, setSize, saved, saveSize, updateSaved, removeSaved };
}
