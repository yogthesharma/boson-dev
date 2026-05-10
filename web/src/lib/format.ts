export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
