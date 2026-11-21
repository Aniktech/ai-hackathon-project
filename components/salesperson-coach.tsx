"use client";

import { useState } from "react";

type CoachMetrics = {
  bills: number;
  peerBills: number | null;
  cityPeerBills: number | null;
  statePeerBills: number | null;
  itemsPerBill: number | null;
  peerItemsPerBill: number | null;
  cityPeerItemsPerBill: number | null;
  statePeerItemsPerBill: number | null;
};

export function SalespersonCoach({ metrics, initialText }: { metrics: CoachMetrics; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [personalized, setPersonalized] = useState(false);

  async function personalize() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/insights/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metrics),
      });
      const result = await response.json() as { suggestion?: string; note?: string };
      if (result.suggestion) setText(result.suggestion);
      setMessage(result.note ?? (response.ok ? "Personalized from verified peer metrics." : "Could not create a coaching suggestion."));
      if (response.ok) setPersonalized(true);
    } catch {
      setMessage("Gemini is temporarily unavailable; the metric-based suggestion is shown.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="coach-card">
    <p>{text}</p>
    <button className="coach-action" type="button" onClick={personalize} disabled={busy || personalized}>
      {busy ? "Personalizing…" : personalized ? "Personalized" : "Personalize with Gemini"}
    </button>
    {message && <small className="coach-status" role="status">{message}</small>}
  </div>;
}
