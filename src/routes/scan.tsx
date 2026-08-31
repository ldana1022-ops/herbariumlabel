import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, Camera, CameraOff, Keyboard } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/scan")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مسح الباركود | نظام إدارة ملصقات المعشبة" },
      {
        name: "description",
        content: "مسح باركود العينة عبر كاميرا الهاتف لفتح بياناتها تلقائيًا.",
      },
      { property: "og:title", content: "مسح الباركود | نظام إدارة ملصقات المعشبة" },
      { property: "og:description", content: "افتح بيانات العينة بمسح الباركود عبر الكاميرا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScanPage,
});

import { normalizeSerial } from "@/lib/serial";


function ScanPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const regionId = "barcode-scanner-region";
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState(false);

  async function startScan() {
    setError(null);
    setDetected(false);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
          aspectRatio: 2,
        },
        (decodedText: string) => {
          const clean = normalizeSerial(decodedText);
          if (clean) {
            setDetected(true);
            void stopScan();
            navigate({ to: "/p/$serial", params: { serial: clean } });
          }
        },
        () => {
          // per-frame failure — ignore, keep scanning
        },
      );
      setScanning(true);
    } catch (err) {
      setError(t("scanError"));
      setScanning(false);
    }
  }

  async function stopScan() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        const state = scanner.getState?.();
        if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
          await scanner.stop();
        }
        scanner.clear();
      } catch {
        // ignore cleanup errors
      }
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      void stopScan();
    };
  }, []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeSerial(manual);
    if (clean) {
      setManualError(false);
      void stopScan();
      navigate({ to: "/p/$serial", params: { serial: clean } });
    } else {
      setManualError(true);
    }
  }

  return (
    <div dir={dir} className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <BackButton fallbackTo={null} />
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ScanLine className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t("scanTitle")}</h1>
          <p className="text-xs text-muted-foreground">{t("scanHint")}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          {/* Scanner viewport */}
          <div className="relative overflow-hidden rounded-lg border border-border bg-black">
            <div id={regionId} className="w-full" style={{ minHeight: scanning ? 220 : 180 }} />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="size-8" />
                <span className="text-xs">{t("scanHint")}</span>
              </div>
            )}
            {detected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-sm font-medium text-white">{t("scanDetected")}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <CameraOff className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            {!scanning ? (
              <Button onClick={() => void startScan()} className="flex-1 gap-2">
                <Camera className="size-4" />
                {t("scanStart")}
              </Button>
            ) : (
              <Button onClick={() => void stopScan()} variant="outline" className="flex-1 gap-2">
                <CameraOff className="size-4" />
                {t("scanStop")}
              </Button>
            )}
          </div>

          {/* Manual entry fallback */}
          <div className="border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="size-3.5" />
              {t("scanEnterManual")}
            </div>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  setManualError(false);
                }}
                placeholder="NCVCH000001"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm uppercase placeholder:normal-case placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" size="sm">
                {t("view")}
              </Button>
            </form>
            {manualError && <p className="mt-1 text-xs text-destructive">{t("serialNotFound")}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
