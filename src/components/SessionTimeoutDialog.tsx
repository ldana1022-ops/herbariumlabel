import { useSessionGuard } from "@/lib/session-guard";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SessionTimeoutDialog() {
  const { warning, secondsLeft, extend, logoutNow } = useSessionGuard();
  const { t, dir } = useI18n();

  return (
    <AlertDialog open={warning}>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("sessionEndingTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("sessionEndingBody")} ({secondsLeft})
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button variant="outline" onClick={logoutNow}>
            {t("signOutNow")}
          </Button>
          <Button onClick={extend}>{t("staySignedIn")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
