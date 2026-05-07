import type { HttpMethod } from "@/lib/http";

import { RequestBar } from "./request-bar";

/**
 * Sticky top section of the request pane: just the method + URL + Send bar
 * with consistent padding. Kept as its own component so the rest of the pane
 * (tabs + content) can be a separate, independently sized region below.
 */
export function RequestHeader({
  method,
  onMethodChange,
  url,
  onUrlChange,
  loading,
  onSend,
  onCancel,
}: {
  method: HttpMethod;
  onMethodChange: (m: HttpMethod) => void;
  url: string;
  onUrlChange: (s: string) => void;
  loading: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="shrink-0 px-2 pt-1 pb-3 sm:px-4">
      <RequestBar
        method={method}
        onMethodChange={onMethodChange}
        url={url}
        onUrlChange={onUrlChange}
        loading={loading}
        onSend={onSend}
        onCancel={onCancel}
      />
    </div>
  );
}
