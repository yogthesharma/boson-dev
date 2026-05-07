import { useCallback, useRef, useState } from "react";

import { callProxy, type ProxyPayload, type ProxyResponse } from "@/lib/api";

export function useProxyRequest() {
  const [response, setResponse] = useState<ProxyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientRoundTripMs, setClientRoundTripMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (payload: ProxyPayload): Promise<ProxyResponse> => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      setResponse(null);
      setClientRoundTripMs(null);
      const t0 = performance.now();
      let data: ProxyResponse;
      try {
        data = await callProxy(payload, ac.signal);
        setClientRoundTripMs(Math.round(performance.now() - t0));
        setResponse(data);
      } catch (e) {
        const err = e as Error;
        data = {
          ok: false,
          error: err.name === "AbortError" ? "Request cancelled" : String(e),
        };
        setClientRoundTripMs(Math.round(performance.now() - t0));
        setResponse(data);
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
      return data;
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setResponse(null);
    setClientRoundTripMs(null);
  }, []);

  return { response, loading, clientRoundTripMs, send, cancel, reset };
}

export type UseProxyRequest = ReturnType<typeof useProxyRequest>;
