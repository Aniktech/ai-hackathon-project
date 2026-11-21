"use client";

import { useState } from "react";

export type RecommendationCard = {
  id: string;
  runDate: string;
  ownerType: string;
  ownerId: string;
  areaManagerName: string;
  storeId: string;
  city: string;
  lever: string;
  cause: string;
  opportunity: number;
  action: string;
  baselineValue: number;
  outcomeValue: number | null;
  status: string;
};

export function RecommendationCenter({ records, allowRun = false }: { records: RecommendationCard[]; allowRun?: boolean }) {
  const [token, setToken] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run() {
    setBusy("run"); setMessage("");
    try {
      const response = await fetch("/api/cron/daily", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json() as { generated?: number; skipped?: string; error?: string };
      setMessage(response.ok ? `${result.generated ?? 0} recommendations recorded.${result.skipped ? ` ${result.skipped}` : " Refresh to see the latest cards."}` : result.error ?? "Analysis failed.");
    } catch { setMessage("Could not reach the analysis service."); }
    finally { setBusy(""); }
  }

  async function complete(id: string) {
    setBusy(id); setMessage("");
    try {
      const response = await fetch(`/api/recommendations/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed", outcomeValue: Number(outcomes[id]) }) });
      const result = await response.json() as { error?: string };
      setMessage(response.ok ? "Follow-up saved. Refresh to view the result." : result.error ?? "Could not save follow-up.");
    } catch { setMessage("Could not reach the follow-up service."); }
    finally { setBusy(""); }
  }

  return <div className="recommendation-center">
    <label className="field-label" htmlFor="action-token">Admin token</label>
    <input id="action-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter admin token" />
    {allowRun && <button type="button" className="small-action" disabled={!token || Boolean(busy)} onClick={run}>{busy === "run" ? "Analyzing…" : "Run today’s analysis"}</button>}
    {message && <p className="import-result" role="status">{message}</p>}
    {records.length ? <div className="recommendation-records">{records.map((record) => <article className="recommendation-record" key={record.id}>
      <div className="record-heading"><div><p className="section-kicker">{record.ownerType === "salesperson" ? "SALESPERSON COACHING" : "AREA MANAGER ISSUE"} · {record.lever.toUpperCase()}</p><h3>{record.storeId} · {record.city}</h3></div><span className={`status-pill status-${record.status}`}>{record.status}</span></div>
      <p className="record-meta">{record.areaManagerName} · {new Date(`${record.runDate}T00:00:00`).toLocaleDateString("en-IN")} · {record.opportunity > 0 ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(record.opportunity) : "Peer coaching"}</p>
      <p><strong>Observed signal:</strong> {record.cause}</p>
      <p><strong>Action:</strong> {record.action}</p>
      {record.status === "completed" ? <div className="record-outcome"><span>Baseline: {record.baselineValue.toFixed(2)}</span><span>Follow-up: {record.outcomeValue?.toFixed(2) ?? "—"}</span><strong>{record.outcomeValue === null ? "" : record.outcomeValue >= record.baselineValue ? "Improved" : "Declined"}</strong></div> : <div className="record-followup"><label htmlFor={`outcome-${record.id}`}>Measured result ({record.lever === "conversion" ? "enter % as a decimal, e.g. 0.18" : record.lever === "basket" ? "items per bill" : record.lever === "pairing" ? "attach rate as a decimal, e.g. 0.24" : "bills"})</label><input id={`outcome-${record.id}`} type="number" step="0.01" value={outcomes[record.id] ?? ""} onChange={(event) => setOutcomes((values) => ({ ...values, [record.id]: event.target.value }))} /><button type="button" disabled={!token || !outcomes[record.id] || Boolean(busy)} onClick={() => complete(record.id)}>{busy === record.id ? "Saving…" : "Record follow-up"}</button></div>}
    </article>)}</div> : <p className="empty-note">No recommendations have been recorded yet. Run the protected daily analysis after importing a validated workbook.</p>}
  </div>;
}
