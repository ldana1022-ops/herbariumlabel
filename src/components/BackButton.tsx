import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Number of in-app navigations made during this session (module scope = survives route swaps). */
let inAppDepth = 0;

/**
 * Unified back control: steps back through in-app history without a reload,
 * and falls back to the dashboard when there is nothing to go back to.
 */
export function BackButton() {
  const { t, dir } = useI18n();
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);
  const [depth, setDepth] = useState(inAppDepth);

  useEffect(() => {
    if (lastPath.current !== null && lastPath.current !== pathname) {
      inAppDepth += 1;
    }
    lastPath.current = pathname;
    setDepth(inAppDepth);
  }, [pathname]);

  const canGoBack = depth > 0;
  // Never render on the dashboard when there is no previous in-app page.
  if (pathname === "/" && !canGoBack) return null;

  const Icon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => {
        if (inAppDepth > 0) {
          inAppDepth -= 1;
          setDepth(inAppDepth);
          router.history.back();
          return;
        }
        void navigate({ to: "/" });
      }}
    >
      <Icon className="size-4" />
      {t("back")}
    </Button>
  );
}
