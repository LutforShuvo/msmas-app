"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

function fmt(n) {
  return (Number(n) || 0).toLocaleString();
}

function summarize(entry, storeName) {
  const debitLines = entry.lines.filter((l) => l.debit);
  const creditLines = entry.lines.filter((l) => l.credit);
  const total = debitLines.reduce((s, l) => s + l.debit, 0);
  const stores = [...new Set(entry.lines.map((l) => l.store).filter(Boolean))].map(storeName);

  const describe = (group) =>
    group.length <= 1 ? group[0]?.account || "" : `${group[0].account} split across ${group.length} stores`;

  const debitDesc = describe(debitLines);
  const creditDesc = describe(creditLines);
  const storesText = stores.length > 1 ? `${stores.join(", ")}` : stores[0] || "";

  return `৳${fmt(total)} — ${debitDesc}, via ${creditDesc}${storesText ? ` · ${storesText}` : ""}`;
}

function EntryCard({ entry, storeName, canApprove, canEdit, onApprove, approving }) {
  return (
    <div className="card entry-card">
      <div className="entry-head">
        <div>
          <span className="entry-type">{entry.type}</span>
          <span className="entry-date">{entry.date}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`entry-status ${entry.status}`}>{entry.status}</span>
          {canEdit && (
            <Link href={`/entries/${entry.txnId}/edit`} className="link-btn" style={{ fontSize: 12 }}>
              Edit
            </Link>
          )}
        </div>
      </div>
      <p className="entry-summary">{summarize(entry, storeName)}</p>
      {entry.note && <p className="entry-note">{entry.note}</p>}
      {canApprove && (
        <button className="approve-btn" disabled={approving} onClick={() => onApprove(entry.txnId)}>
          {approving ? "Approving…" : "✓ Approve"}
        </button>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [entries, setEntries] = useState(null);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [toast, setToast] = useState(null);

  function loadEntries() {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEntries(data.entries);
        else setError(data.error || "Could not load entries.");
      })
      .catch(() => setError("Could not reach the server."));
  }

  useEffect(() => {
    loadEntries();
    fetch("/api/lookups").then((r) => r.json()).then((d) => {
      if (d.ok) setStores(d.stores);
    }).catch(() => {});
  }, []);

  const storeName = (id) => stores.find((s) => s.id === id)?.name || id;

  const pending = useMemo(() => (entries || []).filter((e) => e.status !== "posted"), [entries]);
  const approved = useMemo(() => (entries || []).filter((e) => e.status === "posted"), [entries]);

  async function handleApprove(txnId) {
    setApprovingId(txnId);
    setToast(null);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnId }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast({ ok: true, text: `${txnId} approved.` });
        loadEntries();
      } else {
        setToast({ ok: false, text: data.error || "Could not approve." });
      }
    } catch {
      setToast({ ok: false, text: "Could not reach the server." });
    } finally {
      setApprovingId(null);
    }
  }

  const canApprove = role === "admin";
  const canEdit = role === "admin" || role === "entry";

  return (
    <main className="page">
      <h2 className="page-title">Approvals</h2>
      {error && <div className="toast error">{error}</div>}
      {!entries && !error && <div className="summary">Loading…</div>}
      {toast && (
        <div className={`toast ${toast.ok ? "ok" : "error"}`} style={{ marginBottom: 14 }}>
          {toast.ok && <span className="icon">✓</span>}
          <span>{toast.text}</span>
        </div>
      )}

      {entries && (
        <>
          <p className="fs-section" style={{ marginTop: 0 }}>Pending Approval ({pending.length})</p>
          {pending.length === 0 && <p className="summary">Nothing waiting on approval.</p>}
          {pending.map((e) => (
            <EntryCard
              key={e.txnId}
              entry={e}
              storeName={storeName}
              canApprove={canApprove}
              canEdit={canEdit}
              onApprove={handleApprove}
              approving={approvingId === e.txnId}
            />
          ))}

          <p className="fs-section">Approved ({approved.length})</p>
          {approved.length === 0 && <p className="summary">No approved entries yet.</p>}
          {approved.map((e) => (
            <EntryCard key={e.txnId} entry={e} storeName={storeName} canApprove={false} canEdit={canEdit} />
          ))}
        </>
      )}
    </main>
  );
}
