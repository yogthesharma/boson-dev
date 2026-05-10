import type { ApiRequest, HistoryItem, ProjectView } from "@/types";

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${url} failed with HTTP ${response.status}`);
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export async function deleteRequest(url: string): Promise<void> {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    throw new Error(`${url} failed with HTTP ${response.status}`);
  }
}

export const fetchProject = () => getJson<ProjectView>("/api/project");
export const fetchHistory = () => getJson<HistoryItem[]>("/api/history");

export const saveDraft = (id: string, request: ApiRequest) =>
  postJson(`/api/drafts/${id}`, request);

export const promoteDraftToYaml = (id: string) =>
  postJson(`/api/drafts/${id}/save`, {});

export const discardDraft = (id: string) =>
  deleteRequest(`/api/drafts/${id}`);

export const runRequest = (id: string, environmentId: string | null) =>
  postJson(`/api/requests/${id}/run`, { environment_id: environmentId });
