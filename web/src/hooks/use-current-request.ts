import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EMPTY_FORM,
  formToRequest,
  requestToForm,
  type AuthForm,
  type BodyForm,
  type KvRow,
  type OptionsForm,
  type RequestForm,
} from "@/lib/request-form";
import type { ApiRequest, Draft, ProjectView } from "@/types";

export interface UseCurrentRequestResult {
  form: RequestForm;
  setForm: (next: RequestForm) => void;
  patchForm: (patch: Partial<RequestForm>) => void;
  setQuery: (query: KvRow[]) => void;
  setHeaders: (headers: KvRow[]) => void;
  setBody: (body: BodyForm) => void;
  setAuth: (auth: AuthForm) => void;
  setOptions: (options: OptionsForm) => void;
  selectedDraft: Draft | undefined;
  selectedCanonical: ApiRequest | undefined;
  isStaleDraft: boolean;
  hasUnsavedChanges: boolean;
  draftRequest: () => ApiRequest;
}

export function useCurrentRequest(
  project: ProjectView | null,
  selectedRequestId: string,
): UseCurrentRequestResult {
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<RequestForm>(EMPTY_FORM);

  const selectedDraft = useMemo(
    () =>
      project?.drafts.find((draft) => draft.request_id === selectedRequestId),
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

  // When the selection or upstream data changes, snap the form back to the
  // canonical/draft representation. Comparing serialized JSON detects
  // meaningful schema changes without thrashing on identity-only differences.
  const incomingKey = useMemo(() => {
    const incoming = selectedDraft?.request ?? selectedCanonical;
    if (!incoming) return "::empty";
    return `${selectedRequestId}::${
      selectedDraft ? "draft" : "canonical"
    }::${JSON.stringify(incoming)}`;
  }, [selectedDraft, selectedCanonical, selectedRequestId]);

  useEffect(() => {
    const incoming = selectedDraft?.request ?? selectedCanonical;
    const next = incoming ? requestToForm(incoming) : EMPTY_FORM;
    setForm(next);
    setBaseline(next);
  }, [incomingKey, selectedDraft, selectedCanonical]);

  const patchForm = useCallback((patch: Partial<RequestForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const setQuery = useCallback(
    (query: KvRow[]) => setForm((current) => ({ ...current, query })),
    [],
  );
  const setHeaders = useCallback(
    (headers: KvRow[]) => setForm((current) => ({ ...current, headers })),
    [],
  );
  const setBody = useCallback(
    (body: BodyForm) => setForm((current) => ({ ...current, body })),
    [],
  );
  const setAuth = useCallback(
    (auth: AuthForm) => setForm((current) => ({ ...current, auth })),
    [],
  );
  const setOptions = useCallback(
    (options: OptionsForm) => setForm((current) => ({ ...current, options })),
    [],
  );

  const draftRequest = useCallback(() => formToRequest(form), [form]);

  const hasUnsavedChanges = useMemo(
    () => !formsEqual(form, baseline),
    [form, baseline],
  );

  return {
    form,
    setForm,
    patchForm,
    setQuery,
    setHeaders,
    setBody,
    setAuth,
    setOptions,
    selectedDraft,
    selectedCanonical,
    isStaleDraft,
    hasUnsavedChanges,
    draftRequest,
  };
}

function formsEqual(a: RequestForm, b: RequestForm): boolean {
  // Cheap structural equality: stable JSON works because every field is
  // either a primitive, a plain object or a row array with stable keys.
  return JSON.stringify(a) === JSON.stringify(b);
}
