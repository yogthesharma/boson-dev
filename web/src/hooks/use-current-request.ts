import { useEffect, useMemo, useState } from "react";

import { bodyToText, headersToText, textToHeaders } from "@/lib/format";
import type { ApiRequest, Draft, ProjectView } from "@/types";

const EMPTY_REQUEST: ApiRequest = {
  id: "",
  name: "",
  method: "GET",
  url: "",
  headers: {},
  body: "",
};

export interface UseCurrentRequestResult {
  form: ApiRequest;
  setForm: (request: ApiRequest) => void;
  headersText: string;
  setHeadersText: (text: string) => void;
  bodyText: string;
  setBodyText: (text: string) => void;
  selectedDraft: Draft | undefined;
  selectedCanonical: ApiRequest | undefined;
  isStaleDraft: boolean;
  draftRequest: () => ApiRequest;
}

export function useCurrentRequest(
  project: ProjectView | null,
  selectedRequestId: string,
): UseCurrentRequestResult {
  const [form, setForm] = useState<ApiRequest>(EMPTY_REQUEST);
  const [headersText, setHeadersText] = useState("");
  const [bodyText, setBodyText] = useState("");

  const selectedDraft = useMemo(
    () => project?.drafts.find((draft) => draft.request_id === selectedRequestId),
    [project?.drafts, selectedRequestId],
  );

  const selectedCanonical = useMemo(
    () =>
      project?.requests.find((request) => request.id === selectedRequestId),
    [project?.requests, selectedRequestId],
  );

  const isStaleDraft = useMemo(() => {
    if (!project || !selectedRequestId) return false;
    return (project.stale_drafts ?? []).includes(selectedRequestId);
  }, [project, selectedRequestId]);

  useEffect(() => {
    const next = selectedDraft?.request ?? selectedCanonical ?? EMPTY_REQUEST;
    setForm(next);
    setHeadersText(headersToText(next.headers));
    setBodyText(bodyToText(next.body));
  }, [selectedCanonical, selectedDraft]);

  function draftRequest(): ApiRequest {
    return {
      ...form,
      headers: textToHeaders(headersText),
      body: bodyText,
    };
  }

  return {
    form,
    setForm,
    headersText,
    setHeadersText,
    bodyText,
    setBodyText,
    selectedDraft,
    selectedCanonical,
    isStaleDraft,
    draftRequest,
  };
}
