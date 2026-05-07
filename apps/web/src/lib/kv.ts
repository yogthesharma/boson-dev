export type KvRow = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

export function newKvRow(init: Partial<Omit<KvRow, "id">> = {}): KvRow {
  return {
    id: crypto.randomUUID(),
    key: "",
    value: "",
    enabled: true,
    ...init,
  };
}

export function mergeQueryParams(urlString: string, rows: KvRow[]): string {
  try {
    const u = new URL(urlString);
    for (const r of rows) {
      if (!r.enabled) continue;
      const k = r.key.trim();
      if (!k) continue;
      u.searchParams.set(k, r.value);
    }
    return u.toString();
  } catch {
    return urlString;
  }
}

export function rowsToHeaders(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (!r.enabled) continue;
    const k = r.key.trim();
    if (!k) continue;
    out[k] = r.value;
  }
  return out;
}
