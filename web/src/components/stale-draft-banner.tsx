import { Card, CardContent } from "@/components/ui/card";

export function StaleDraftBanner() {
  return (
    <Card className="border-amber-500/30 bg-amber-500/10">
      <CardContent className="p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          The YAML source for this request has changed since the draft was
          saved. Re-saving will overwrite the file.
        </p>
      </CardContent>
    </Card>
  );
}
