"use client";

import { useState } from "react";

type ImportResult = { ready?: boolean; imported?: boolean; counts?: Record<string, number>; errors?: string[]; error?: string; note?: string };

export function ImportPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(mode: "preview" | "import") {
    if (!files.length || !token) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.set("mode", mode);
      const response = await fetch("/api/import", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const body = await response.json() as ImportResult;
      setResult(body);
    } catch {
      setResult({ error: "Could not reach the import service. Check the local server and try again." });
    } finally {
      setBusy(false);
    }
  }

  return <div className="import-panel">
    <p className="import-copy">Upload the original workbook, or select the full CSV export together. Store Coach validates tabs and fields before writing; it does not invent or modify business data.</p>
    <label className="field-label" htmlFor="dataset-file">Participant workbook (.xlsx) or CSV table bundle</label>
    <input id="dataset-file" type="file" multiple accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setResult(null); }} />
    {files.length > 0 && <span className="import-file-list">{files.length === 1 ? files[0].name : `${files.length} CSV files selected`}</span>}
    <label className="field-label" htmlFor="import-token">Admin token</label>
    <input id="import-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter admin token" />
    <div className="import-actions"><button type="button" disabled={!files.length || !token || busy} onClick={() => submit("preview")}>{busy ? "Checking…" : "Validate data"}</button><button type="button" disabled={!files.length || !token || busy || !result?.ready} onClick={() => submit("import")}>{busy ? "Importing…" : "Import validated data"}</button></div>
    {result?.error && <p className="import-error" role="alert">{result.error}</p>}
    {result?.errors?.length ? <div className="import-error" role="alert"><strong>Fix these workbook issues:</strong><ul>{result.errors.slice(0, 20).map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
    {result?.counts && <div className="import-result" role="status"><strong>{result.imported ? "Import complete" : "Workbook is ready"}</strong>{result.note && <p>{result.note}</p>}<ul>{Object.entries(result.counts).map(([name, count]) => <li key={name}><span>{name.replaceAll("_", " ")}</span><b>{count.toLocaleString("en-IN")}</b></li>)}</ul></div>}
  </div>;
}
