"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyLine = { accountId: "", storeId: "", partyType: "", partyId: "", debit: "", credit: "" };

export default function JournalEntryPage() {
  const router = useRouter();
  const [lookups, setLookups] = useState({ stores: [], accounts: [], customers: [], vendors: [] });
  const [date, setDate] = useState(todayLocal);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([{ ...emptyLine }, { ...emptyLine }]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch("/api/lookups")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setLookups(d);
      })
      .catch(() => {});
  }, []);

  function updateLine(i, key, value) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      if (key === "partyType") next[i].partyId = ""; // reset selection when switching Customer/Vendor
      return next;
    });
  }
  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;
  const allAccountsPicked = lines.every((l) => l.accountId);
  const canSubmit = balanced && allAccountsPicked && lines.length >= 2 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          note,
          lines: lines.map((l) => ({
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
      if (data.ok) {
        setToast({ ok: true, text: `Saved as ${data.txnId} — pending approval.` });
        setNote("");
        setLines([{ ...emptyLine }, { ...emptyLine }]);
      } else {
        setToast({ ok: false, text: data.error || "Could not save." });
      }
    } catch {
      setToast({ ok: false, text: "Could not reach the server." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <h2 className="page-title">Journal Entry</h2>
      <div className="card">
        <p className="summary" style={{ marginBottom: 14 }}>
          For entries that don't fit Sale, Expense, or Transfer — inventory adjustments,
          opening balances for a new account, or any other one-off entry. Pick any accounts,
          any number of lines, as long as debit equals credit. Saves as pending approval,
          same as everything else.
        </p>

        <div className="row-2">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. August stock count adjustment" />
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.9fr 0.9fr 26px", gap: 8, fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              <span>Account</span><span>Store</span><span>Party type</span><span>Party</span><span>Debit</span><span>Credit</span><span></span>
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.9fr 0.9fr 26px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                <select value={l.accountId} onChange={(e) => updateLine(i, "accountId", e.target.value)}>
                  <option value="">Select account</option>
                  {lookups.accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <select value={l.storeId} onChange={(e) => updateLine(i, "storeId", e.target.value)}>
                  <option value="">— none —</option>
                  {lookups.stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select value={l.partyType} onChange={(e) => updateLine(i, "partyType", e.target.value)}>
                  <option value="">— none —</option>
                  <option value="Customer">Customer</option>
                  <option value="Vendor">Vendor</option>
                </select>
                <select
                  value={l.partyId}
                  onChange={(e) => updateLine(i, "partyId", e.target.value)}
                  disabled={!l.partyType}
                >
                  <option value="">Select</option>
                  {(l.partyType === "Customer" ? lookups.customers : l.partyType === "Vendor" ? lookups.vendors : []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input type="number" value={l.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} placeholder="0" />
                <input type="number" value={l.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} placeholder="0" />
                {lines.length > 2 && (
                  <button type="button" aria-label="Remove line" onClick={() => removeLine(i)} style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <button type="button" className="link-btn" onClick={addLine}>+ Add line</button>

        <div className={`summary ${totalDebit > 0 ? (balanced ? "ok" : "error") : ""}`} style={{ marginTop: 14 }}>
          Debit {totalDebit.toLocaleString()} · Credit {totalCredit.toLocaleString()}
          {totalDebit > 0 && (balanced ? " — balanced" : ` — off by ${Math.abs(totalDebit - totalCredit).toLocaleString()}`)}
        </div>

        <button className="submit-btn" disabled={!canSubmit} onClick={submit}>
          {saving ? "Saving…" : "Submit journal entry"}
        </button>

        {toast && (
          <div className={`toast ${toast.ok ? "ok" : "error"}`}>
            {toast.ok && <span className="icon">✓</span>}
            <span>{toast.text}</span>
          </div>
        )}
      </div>
    </main>
  );
}
