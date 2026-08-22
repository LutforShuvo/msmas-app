"use client";

import { useEffect, useMemo, useState } from "react";

const CASH_CLASSES = ["Bank", "Cash & Cash Equivalent"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(n) {
  return (Number(n) || 0).toLocaleString();
}

export default function EntryForm() {
  const [type, setType] = useState("sale");
  const [lookups, setLookups] = useState({ stores: [], customers: [], vendors: [], accounts: [] });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  // sale fields
  const [saleStore, setSaleStore] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [onCredit, setOnCredit] = useState(false);
  const [saleMethod, setSaleMethod] = useState("");
  const [customerId, setCustomerId] = useState("");

  // expense fields (also covers Purchase)
  const [category, setCategory] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expOnCredit, setExpOnCredit] = useState(false);
  const [expMethod, setExpMethod] = useState("");
  const [expVendorId, setExpVendorId] = useState("");
  const [shared, setShared] = useState(false);
  const [expStore, setExpStore] = useState("");
  const [splits, setSplits] = useState([{ store: "", amount: "" }]);

  // transfer fields (also covers Bank Transfer / Payment / Receipt)
  const [fromKind, setFromKind] = useState("account");
  const [fromId, setFromId] = useState("");
  const [toKind, setToKind] = useState("account");
  const [toId, setToId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferStore, setTransferStore] = useState("");

  useEffect(() => {
    fetch("/api/lookups")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        const normalized = {
          stores: data.stores.map((s) => ({ ...s, id: String(s.id) })),
          customers: data.customers.map((c) => ({ ...c, id: String(c.id) })),
          vendors: data.vendors.map((v) => ({ ...v, id: String(v.id) })),
          accounts: data.accounts.map((a) => ({
            ...a,
            id: String(a.id),
            accountType: (a.accountType || "").trim(),
            accountClass: (a.accountClass || "").trim(),
          })),
        };
        setLookups(normalized);
        if (normalized.stores[0]) {
          setSaleStore(normalized.stores[0].id);
          setExpStore(normalized.stores[0].id);
        }
        const cashAccounts = normalized.accounts.filter((a) => CASH_CLASSES.includes(a.accountClass));
        const expenseAccounts = normalized.accounts.filter((a) => a.accountType === "Expense");
        if (cashAccounts[0]) {
          setSaleMethod(cashAccounts[0].id);
          setExpMethod(cashAccounts[0].id);
          setFromId(cashAccounts[0].id);
          setToId(cashAccounts[0].id);
        }
        if (expenseAccounts[0]) setCategory(expenseAccounts[0].id);
        if (normalized.vendors[0]) setExpVendorId(normalized.vendors[0].id);
      })
      .catch(() => {});
  }, []);

  function dedupeById(list) {
    const seen = new Set();
    return list.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }

  const cashAccounts = useMemo(
    () => dedupeById(lookups.accounts.filter((a) => CASH_CLASSES.includes(a.accountClass))),
    [lookups.accounts]
  );
  const expenseAccounts = useMemo(
    () => dedupeById(lookups.accounts.filter((a) => a.accountType === "Expense")),
    [lookups.accounts]
  );

  function storeName(id) {
    return lookups.stores.find((s) => s.id === id)?.name || id;
  }
  function accountName(id) {
    return lookups.accounts.find((a) => a.id === id)?.name || id;
  }
  function categoryName(id) {
    return lookups.accounts.find((a) => a.id === id)?.name || id;
  }
  function vendorName(id) {
    return lookups.vendors.find((v) => v.id === id)?.name || id;
  }
  function customerName(id) {
    return lookups.customers.find((c) => c.id === id)?.name || id;
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

  // What the transfer will be called, based purely on what's picked — not which tab.
  const transferLabel = toKind === "vendor" ? "Payment" : fromKind === "customer" ? "Receipt" : "Bank Transfer";
  const needsTransferStore = toKind === "vendor" || fromKind === "customer";

  function summary() {
    if (type === "sale") {
      if (!saleAmount) return { text: "Fill in the details to see a summary here.", ok: null };
      return onCredit
        ? { text: `This will record a ${fmt(saleAmount)} sale for ${storeName(saleStore)}, owed by the selected customer.`, ok: true }
        : { text: `This will record ${fmt(saleAmount)} received into ${accountName(saleMethod)} as sales for ${storeName(saleStore)}.`, ok: true };
    }
    if (type === "expense") {
      if (!expAmount) return { text: "Fill in the details to see a summary here.", ok: null };
      const paidPhrase = expOnCredit ? `owed to ${vendorName(expVendorId)}` : `paid from ${accountName(expMethod)}`;
      if (shared) {
        return {
          text: splitsMatch
            ? `This will record ${fmt(expAmount)} ${categoryName(category).toLowerCase()}, ${paidPhrase}, split across ${splits.length} stores.`
            : `Split adds up to ${fmt(splitTotal)}, not ${fmt(expAmount)} — adjust before submitting.`,
          ok: splitsMatch,
        };
      }
      return { text: `This will record ${fmt(expAmount)} ${categoryName(category).toLowerCase()} for ${storeName(expStore)}, ${paidPhrase}.`, ok: true };
    }
    if (type === "transfer") {
      if (!transferAmount) return { text: "Fill in the details to see a summary here.", ok: null };
      const fromLabel = fromKind === "customer" ? customerName(fromId) : accountName(fromId);
      const toLabel = toKind === "vendor" ? vendorName(toId) : accountName(toId);
      return { text: `This will record a "${transferLabel}" of ${fmt(transferAmount)} — from ${fromLabel} to ${toLabel}.`, ok: true };
    }
    return { text: "Fill in the details to see a summary here.", ok: null };
  }

  const s = summary();
  const canSubmit =
    !submitting &&
    ((type === "sale" && saleAmount && saleStore && (onCredit ? customerId : saleMethod)) ||
      (type === "expense" && expAmount && category && (expOnCredit ? expVendorId : expMethod) && (shared ? splitsMatch : expStore)) ||
      (type === "transfer" && transferAmount && fromId && toId && (needsTransferStore ? transferStore : true) && !(fromKind === "account" && toKind === "account" && fromId === toId)));

  async function submit() {
    setSubmitting(true);
    setToast(null);
    const summaryAtSubmit = s.text;
    let payload = { type, date, note };
    if (type === "sale") {
      payload = { ...payload, store: saleStore, amount: Number(saleAmount), onCredit, method: saleMethod, customerId };
    } else if (type === "expense") {
      payload = {
        ...payload,
        category,
        amount: Number(expAmount),
        onCredit: expOnCredit,
        method: expMethod,
        vendorId: expVendorId,
        shared,
        store: expStore,
        splits: splits.map((r) => ({ store: r.store, amount: Number(r.amount) })),
      };
    } else {
      payload = {
        ...payload,
        fromKind,
        fromId,
        toKind,
        toId,
        amount: Number(transferAmount),
        store: needsTransferStore ? transferStore : "",
      };
    }

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setToast({ ok: true, text: `${summaryAtSubmit} (Saved as ${data.txnId})` });
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
                {cashAccounts.map((a) => (
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
                {expenseAccounts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="checkbox-row">
            <input type="checkbox" checked={expOnCredit} onChange={(e) => setExpOnCredit(e.target.checked)} />
            Buying on credit (pay the supplier later)
          </div>
          {expOnCredit ? (
            <div className="field">
              <label>Supplier</label>
              <select value={expVendorId} onChange={(e) => setExpVendorId(e.target.value)}>
                {lookups.vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label>Paid from</label>
              <select value={expMethod} onChange={(e) => setExpMethod(e.target.value)}>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

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
              <label>Money comes from</label>
              <select
                value={`${fromKind}:${fromId}`}
                onChange={(e) => {
                  const [k, id] = e.target.value.split(":");
                  setFromKind(k);
                  setFromId(id);
                }}
              >
                <optgroup label="Accounts">
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>{a.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Customers (collecting what they owe)">
                  {lookups.customers.map((c) => (
                    <option key={c.id} value={`customer:${c.id}`}>{c.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label>Money goes to</label>
              <select
                value={`${toKind}:${toId}`}
                onChange={(e) => {
                  const [k, id] = e.target.value.split(":");
                  setToKind(k);
                  setToId(id);
                }}
              >
                <optgroup label="Accounts">
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>{a.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Suppliers (paying down what you owe)">
                  {lookups.vendors.map((v) => (
                    <option key={v.id} value={`vendor:${v.id}`}>{v.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
          <div className="row-2">
            <div className="field">
              <label>Amount</label>
              <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0" />
            </div>
            {needsTransferStore && (
              <div className="field">
                <label>Store</label>
                <select value={transferStore} onChange={(e) => setTransferStore(e.target.value)}>
                  <option value="">Select store</option>
                  {lookups.stores.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}

      <div className={`summary ${s.ok === true ? "ok" : s.ok === false ? "error" : ""}`}>{s.text}</div>

      <button className="submit-btn" disabled={!canSubmit} onClick={submit}>
        {submitting ? "Saving…" : "Submit transaction"}
      </button>

      {toast && (
        <div className={`toast ${toast.ok ? "ok" : "error"}`}>
          {toast.ok && <span className="icon">✓</span>}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
