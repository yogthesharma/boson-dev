import { LoaderCircleIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function LoadingScreen() {
  return (
    <main className="flex h-full items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" />
        <span>Loading Boson project...</span>
      </div>
    </main>
  );
}

export function BootstrapErrorScreen({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-3 text-4xl font-semibold tracking-tight">Boson</h1>
      <Card className="mb-4">
        <CardContent className="p-6">
          <p className="text-destructive">{message}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run <code className="font-mono">boson init</code> in this project,
            then restart the server.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
