"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditTransactionPage() {
  const { txnId } = useParams();
  const router = useRouter();

  const [lookups, setLookups] = useState({ stores: [], accounts: [], customers: [], vendors: [] });
  const [txn, setTxn] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/lookups").then((r) => r.json()),
      fetch(`/api/transaction?txnId=${encodeURIComponent(txnId)}`).then((r) => r.json()),
    ])
      .then(([lk, tx]) => {
        if (lk.ok) setLookups(lk);
        if (tx.ok) setTxn(tx.transaction);
        else setError(tx.error || "Could not load this transaction.");
      })
      .catch(() => setError("Could not reach the server."));
  }, [txnId]);

  function updateField(key, value) {
    setTxn((t) => ({ ...t, [key]: value }));
  }
  function updateLine(i, key, value) {
    setTxn((t) => {
      const lines = [...t.lines];
      lines[i] = { ...lines[i], [key]: value };
      return { ...t, lines };
    });
  }
  function addLine() {
    setTxn((t) => ({
      ...t,
      lines: [...t.lines, { accountId: "", storeId: "", debit: "", credit: "", partyType: "", partyId: "" }],
    }));
  }
  function removeLine(i) {
    setTxn((t) => ({ ...t, lines: t.lines.filter((_, idx) => idx !== i) }));
  }

  const totalDebit = txn ? txn.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : 0;
  const totalCredit = txn ? txn.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) : 0;
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  async function save() {
    if (!balanced) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/transaction", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txnId: txn.txnId,
          date: txn.date,
          note: txn.note,
          status: txn.status,
          lines: txn.lines.map((l) => ({
            accountId: l.accountId,
            storeId: l.storeId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            partyType: l.partyType,
            partyId: l.partyId,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) router.push("/entries");
      else setSaveError(data.error || "Could not save changes.");
    } catch {
      setSaveError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <main className="page">
        <h2 className="page-title">Edit Transaction</h2>
        <div className="toast error">{error}</div>
      </main>
    );
  }
  if (!txn) {
    return (
      <main className="page">
        <h2 className="page-title">Edit Transaction</h2>
        <div className="summary">Loading…</div>
      </main>
    );
  }

  return (
    <main className="page">
      <h2 className="page-title">Edit Transaction — {txn.txnId}</h2>
      <div className="card">
        <div className="row-2">
          <div className="field">
            <label>Date</label>
            <input type="date" value={txn.date} onChange={(e) => updateField("date", e.target.value)} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={txn.status} onChange={(e) => updateField("status", e.target.value)}>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Note</label>
          <input value={txn.note} onChange={(e) => updateField("note", e.target.value)} />
        </div>

        <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 28px", gap: 8, fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
            <span>Account</span><span>Store</span><span>Debit</span><span>Credit</span><span></span>
          </div>
          {txn.lines.map((l, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 28px", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <select value={l.accountId} onChange={(e) => updateLine(i, "accountId", e.target.value)}>
                <option value="">Select account</option>
                {lookups.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <select value={l.storeId} onChange={(e) => updateLine(i, "storeId", e.target.value)}>
                <option value="">Select store</option>
                {lookups.stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input type="number" value={l.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} placeholder="0" />
              <input type="number" value={l.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} placeholder="0" />
              {txn.lines.length > 2 && (
                <button type="button" aria-label="Remove line" onClick={() => removeLine(i)} style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="link-btn" onClick={addLine}>+ Add line</button>
        </div>

        <div className={`summary ${balanced ? "ok" : "error"}`} style={{ marginTop: 14 }}>
          Debit {totalDebit.toLocaleString()} · Credit {totalCredit.toLocaleString()}
          {balanced ? " — balanced" : ` — off by ${Math.abs(totalDebit - totalCredit).toLocaleString()}`}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="submit-btn" disabled={!balanced || saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => router.push("/entries")} style={{ flex: "0 0 auto" }}>
            Cancel
          </button>
        </div>
        {saveError && <div className="toast error">{saveError}</div>}
      </div>
    </main>
  );
}
