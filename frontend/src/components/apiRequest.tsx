import { useEffect, useState } from "react";
import "../styles/App.css";

export default function ApiRequest({
  requestUrl,
  reload,
}: {
  requestUrl?: string;
  reload?: number;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async (requestUrl?: string) => {
      setLoading(true);
      setError(null);
      try {
        // If caller provided a requestUrl use it, otherwise default to /api/Data/current
        const base = (import.meta as any).env?.VITE_API_BASE || "";
        const defaultUrl = `${base}/api/Data/current`;
        const url = requestUrl || defaultUrl;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        console.log("Fetched request data:", res);
        const json = await res.json();
        if (!mounted) return;
        setData(json);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || String(err));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    fetchData(requestUrl);
    return () => {
      mounted = false;
    };
  }, [requestUrl, reload]);

  return (
    <section className="cauldron-levels">
      <h2>Request Output:</h2>
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error}</div>}
      {!loading && !error && (
        <div className="data">
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              textAlign: "left",
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
