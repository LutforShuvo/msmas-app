"use client";

import { useEffect, useState } from "react";

const CASH_BANK = [
  { id: "1000", name: "Cash" },
  { id: "1001", name: "Hasan account" },
  { id: "1002", name: "Rafi account" },
];
const EXPENSE_CATEGORIES = [
  { id: "6000", name: "Salaries & Wages" },
  { id: "6001", name: "Rent Expense" },
  { id: "6002", name: "Utilities Expense" },
  { id: "6003", name: "Advertising & Marketing" },
  { id: "6004", name: "Delivery Expense" },
  { id: "6005", name: "Office Expense" },
  { id: "6009", name: "Travel & Transportation" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(n) {
  return (Number(n) || 0).toLocaleString();
}

export default function EntryForm() {
  const [type, setType] = useState("sale");
  const [lookups, setLookups] = useState({ stores: [], customers: [] });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  // sale fields
  const [saleStore, setSaleStore] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [onCredit, setOnCredit] = useState(false);
  const [saleMethod, setSaleMethod] = useState(CASH_BANK[0].id);
  const [customerId, setCustomerId] = useState("");

  // expense fields
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [expAmount, setExpAmount] = useState("");
  const [expMethod, setExpMethod] = useState(CASH_BANK[0].id);
  const [shared, setShared] = useState(false);
  const [expStore, setExpStore] = useState("");
  const [splits, setSplits] = useState([{ store: "", amount: "" }]);

  // transfer fields
  const [from, setFrom] = useState(CASH_BANK[0].id);
  const [to, setTo] = useState(CASH_BANK[1].id);
  const [transferAmount, setTransferAmount] = useState("");

  useEffect(() => {
    fetch("/api/lookups")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setLookups({ stores: data.stores, customers: data.customers });
          if (data.stores[0]) {
            setSaleStore(data.stores[0].id);
            setExpStore(data.stores[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  function storeName(id) {
    return lookups.stores.find((s) => s.id === id)?.name || id;
  }
  function accountName(id) {
    return CASH_BANK.find((a) => a.id === id)?.name || id;
  }
  function categoryName(id) {
    return EXPENSE_CATEGORIES.find((c) => c.id === id)?.name || id;
  }

  function updateSplit(i, key, value) {
    const next = [...splits];
    next[i] = { ...next[i], [key]: value };
    setSplits(next);
  }
  function addSplit() {
    setSplits([...splits, { store: "", amount: "" }]);
  }
  function removeSplit(i) {
    setSplits(splits.filter((_, idx) => idx !== i));
  }

  const splitTotal = splits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const splitsMatch = shared ? splitTotal === Number(expAmount || 0) && Number(expAmount) > 0 : true;

  function summary() {
    if (type === "sale") {
      if (!saleAmount) return { text: "Fill in the details to see a summary here.", ok: null };
      return onCredit
        ? { text: `This will record a ${fmt(saleAmount)} sale for ${storeName(saleStore)}, owed by the selected customer.`, ok: true }
        : { text: `This will record ${fmt(saleAmount)} received into ${accountName(saleMethod)} as sales for ${storeName(saleStore)}.`, ok: true };
    }
    if (type === "expense") {
      if (!expAmount) return { text: "Fill in the details to see a summary here.", ok: null };
      if (shared) {
        return {
          text: splitsMatch
            ? `This will record ${fmt(expAmount)} ${categoryName(category).toLowerCase()} paid from ${accountName(expMethod)}, split across ${splits.length} stores.`
            : `Split adds up to ${fmt(splitTotal)}, not ${fmt(expAmount)} — adjust before submitting.`,
          ok: splitsMatch,
        };
      }
      return { text: `This will record ${fmt(expAmount)} ${categoryName(category).toLowerCase()} for ${storeName(expStore)}, paid from ${accountName(expMethod)}.`, ok: true };
    }
    if (!transferAmount) return { text: "Fill in the details to see a summary here.", ok: null };
    return { text: `This will move ${fmt(transferAmount)} from ${accountName(from)} to ${accountName(to)}.`, ok: true };
  }

  const s = summary();
  const canSubmit =
    !submitting &&
    ((type === "sale" && saleAmount && saleStore && (onCredit ? customerId : saleMethod)) ||
      (type === "expense" && expAmount && expMethod && (shared ? splitsMatch : expStore)) ||
      (type === "transfer" && transferAmount && from && to && from !== to));

  async function submit() {
    setSubmitting(true);
    setToast(null);
    let payload = { type, date, note };
    if (type === "sale") {
      payload = { ...payload, store: saleStore, amount: Number(saleAmount), onCredit, method: saleMethod, customerId };
    } else if (type === "expense") {
      payload = {
        ...payload,
        category,
        amount: Number(expAmount),
        method: expMethod,
        shared,
        store: expStore,
        splits: splits.map((r) => ({ store: r.store, amount: Number(r.amount) })),
      };
    } else {
      payload = { ...payload, from, to, amount: Number(transferAmount) };
    }

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setToast({ ok: true, text: `Saved as ${data.txnId}.` });
        setSaleAmount("");
        setExpAmount("");
        setTransferAmount("");
        setNote("");
        setSplits([{ store: "", amount: "" }]);
      } else {
        setToast({ ok: false, text: data.error || "Something went wrong." });
      }
    } catch (e) {
      setToast({ ok: false, text: "Could not reach the server." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="tabs">
        {["sale", "expense", "transfer"].map((t) => (
          <button key={t} className={type === t ? "active" : ""} onClick={() => setType(t)}>
            {t === "sale" ? "Sale" : t === "expense" ? "Expense" : "Transfer"}
          </button>
        ))}
      </div>

      <div className="row-2">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. August rent" />
        </div>
      </div>

      {type === "sale" && (
        <>
          <div className="row-2">
            <div className="field">
              <label>Store</label>
              <select value={saleStore} onChange={(e) => setSaleStore(e.target.value)}>
                {lookups.stores.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount received</label>
              <input type="number" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={onCredit} onChange={(e) => setOnCredit(e.target.checked)} />
            Customer paying later (on credit)
          </div>
          {onCredit ? (
            <div className="field">
              <label>Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer</option>
                {lookups.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label>Received into</label>
              <select value={saleMethod} onChange={(e) => setSaleMethod(e.target.value)}>
                {CASH_BANK.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {type === "expense" && (
        <>
          <div className="row-2">
            <div className="field">
              <label>What&apos;s this for</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="field">
            <label>Paid from</label>
            <select value={expMethod} onChange={(e) => setExpMethod(e.target.value)}>
              {CASH_BANK.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            Shared across more than one store
          </div>
          {shared ? (
            <div>
              {splits.map((row, i) => (
                <div className="split-row" key={i}>
                  <select value={row.store} onChange={(e) => updateSplit(i, "store", e.target.value)}>
                    <option value="">Select store</option>
                    {lookups.stores.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                  <input type="number" value={row.amount} onChange={(e) => updateSplit(i, "amount", e.target.value)} placeholder="0" />
                  {splits.length > 1 && (
                    <button type="button" onClick={() => removeSplit(i)} aria-label="Remove store">✕</button>
                  )}
                </div>
              ))}
              <button type="button" className="link-btn" onClick={addSplit}>+ Add store</button>
            </div>
          ) : (
            <div className="field">
              <label>Store</label>
              <select value={expStore} onChange={(e) => setExpStore(e.target.value)}>
                {lookups.stores.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {type === "transfer" && (
        <>
          <div className="row-2">
            <div className="field">
              <label>From</label>
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                {CASH_BANK.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>To</label>
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                {CASH_BANK.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Amount</label>
            <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0" />
          </div>
        </>
      )}

      <div className={`summary ${s.ok === true ? "ok" : s.ok === false ? "error" : ""}`}>{s.text}</div>

      <button className="submit-btn" disabled={!canSubmit} onClick={submit}>
        {submitting ? "Saving…" : "Submit transaction"}
      </button>

      {toast && <div className={`toast ${toast.ok ? "ok" : "error"}`}>{toast.text}</div>}
    </div>
  );
}
