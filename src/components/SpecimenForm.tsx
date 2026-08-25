import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { specimenSchema, type SpecimenInput, type SpecimenPayload } from "@/lib/specimens";

type Props = {
  initial: SpecimenInput;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (payload: SpecimenPayload) => void;
  onCancel?: () => void;
};

const dataFields: Array<{ name: keyof SpecimenInput; type?: string; required?: boolean }> = [
  // accession_number is generated automatically from the serial number — not editable.
  { name: "scientific_name", required: true },
  { name: "family" },
  { name: "local_name" },
  { name: "local_name_ar" },
  { name: "locality" },
  { name: "region" },
  { name: "latitude" },
  { name: "longitude" },
  { name: "altitude_m" },
  { name: "collection_date", type: "date" },
  { name: "collectors" },
];

export function SpecimenForm({ initial, submitting, submitLabel, onSubmit, onCancel }: Props) {
  const { t, f } = useI18n();
  const [values, setValues] = useState<SpecimenInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: keyof SpecimenInput, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = specimenSchema.safeParse(values);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        const code = issue.message;
        next[key] =
          code === "required"
            ? t("required")
            : code === "invalidLat"
              ? t("invalidLat")
              : code === "invalidLong"
                ? t("invalidLong")
                : code === "invalidNumber"
                  ? t("invalidNumber")
                  : code;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  };

  const field = (name: keyof SpecimenInput, type = "text", required = false) => (
    <div key={name} className="space-y-1.5">
      <Label htmlFor={name}>
        {f(name)} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Input
        id={name}
        type={type}
        value={(values[name] as string) ?? ""}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={Boolean(errors[name])}
        dir={type === "date" ? "ltr" : undefined}
      />
      {errors[name] ? <p className="text-xs text-destructive">{errors[name]}</p> : null}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("specimenData")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dataFields.map((d) => field(d.name, d.type ?? "text", d.required))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("determinationSection")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("determinationHint")}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("determination")}
          {field("determined_by")}
          {field("determination_date", "date")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{f("notes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            rows={3}
            value={(values.notes as string) ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
