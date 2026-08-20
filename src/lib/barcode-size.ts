import { useCallback, useEffect, useState } from "react";

export type BarcodeSize = {
  /** rendered width in mm */
  width: number;
  /** bar height in mm */
  height: number;
};

export type SavedBarcodeSize = BarcodeSize & { id: string; name: string };

export const BARCODE_PRESETS: { id: string; label: string; size: BarcodeSize }[] = [
  { id: "small", label: "Small — 35 × 10 mm", size: { width: 35, height: 10 } },
  { id: "medium", label: "Medium — 50 × 14 mm", size: { width: 50, height: 14 } },
  { id: "large", label: "Large — 70 × 20 mm", size: { width: 70, height: 20 } },
];

export const DEFAULT_BARCODE_SIZE: BarcodeSize = { width: 50, height: 14 };

export const BARCODE_LIMITS = { minW: 20, maxW: 160, minH: 6, maxH: 40 };

export const clampBarcodeSize = (s: BarcodeSize): BarcodeSize => ({
  width: Math.min(BARCODE_LIMITS.maxW, Math.max(BARCODE_LIMITS.minW, s.width || 1)),
  height: Math.min(BARCODE_LIMITS.maxH, Math.max(BARCODE_LIMITS.minH, s.height || 1)),
});

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
        if (Array.isArray(parsed)) setSavedState(parsed as SavedBarcodeSize[]);
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
        saved.map((s) => (s.id === id ? { ...s, ...patch, ...clampBarcodeSize({ ...s, ...patch }) } : s)),
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
