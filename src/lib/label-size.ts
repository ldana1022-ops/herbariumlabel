import { useCallback, useEffect, useState } from "react";

export type LabelUnit = "mm" | "cm";

export type LabelSize = {
  width: number;
  height: number;
  unit: LabelUnit;
  fontScale: number;
};

export const DEFAULT_LABEL_SIZE: LabelSize = {
  width: 105,
  height: 74,
  unit: "mm",
  fontScale: 1,
};

export const LABEL_PRESETS: {
  id: string;
  label: string;
  width: number;
  height: number;
  unit: LabelUnit;
}[] = [
  { id: "a6", label: "A6 — 105 × 74 mm", width: 105, height: 74, unit: "mm" },
  { id: "a5", label: "A5 — 148 × 105 mm", width: 148, height: 105, unit: "mm" },
  { id: "small", label: "Small — 90 × 62 mm", width: 90, height: 62, unit: "mm" },
  { id: "wide", label: "Wide — 120 × 70 mm", width: 120, height: 70, unit: "mm" },
  { id: "square", label: "Square — 100 × 100 mm", width: 100, height: 100, unit: "mm" },
];

const STORAGE_KEY = "ncvc-label-size";

export const toMm = (value: number, unit: LabelUnit) => (unit === "cm" ? value * 10 : value);

export function labelStyle(size: LabelSize): React.CSSProperties {
  return {
    ["--label-w" as string]: `${toMm(size.width, size.unit)}mm`,
    ["--label-h" as string]: `${toMm(size.height, size.unit)}mm`,
    ["--label-scale" as string]: String(size.fontScale),
  };
}

export function useLabelSize() {
  const [size, setSizeState] = useState<LabelSize>(DEFAULT_LABEL_SIZE);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LabelSize>;
        setSizeState({ ...DEFAULT_LABEL_SIZE, ...parsed });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setSize = useCallback((next: LabelSize) => {
    setSizeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  return { size, setSize };
}
