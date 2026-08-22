import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/**
 * History index of the first page loaded in this session. Anything above it was
 * reached by in-app navigation, so it is safe to step back to.
 */
let baselineIndex: number | null = null;

/**
 * Unified back control: steps back through in-app history without a reload and
 * without ever looping, and falls back to the dashboard when there is no
 * previous in-app page (or hides itself when `fallbackTo` is `null`).
 */
export function BackButton({
  fallbackTo = "/",
  className,
}: {
  /** Where to go when there is no in-app history. `null` hides the button instead. */
  fallbackTo?: string | null;
  className?: string;
} = {}) {
  const { t, dir } = useI18n();
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const index = useRouterState({
    select: (s) => (s.location.state as { __TSR_index?: number } | undefined)?.__TSR_index ?? 0,
  });

  if (baselineIndex === null || index < baselineIndex) baselineIndex = index;
  const canGoBack = index > baselineIndex;

  if (!canGoBack && (fallbackTo === null || pathname === fallbackTo)) return null;

  const Icon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className ? `gap-2 ${className}` : "gap-2"}
      onClick={() => {
        if (canGoBack) {
          router.history.back();
          return;
        }
        if (fallbackTo) void navigate({ to: fallbackTo });
      }}
    >
      <Icon className="size-4" />
      {t("back")}
    </Button>
  );
}
