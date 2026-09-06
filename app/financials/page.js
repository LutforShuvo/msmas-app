"use client";

import { useEffect, useState } from "react";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstOfMonthLocal() {
  return todayLocal().slice(0, 8) + "01";
}

function fmt(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}৳${Math.abs(v).toLocaleString()}`;
}

function Row({ label, value, bold, indent }) {
  return (
    <div className={`fs-row ${bold ? "fs-row-bold" : ""}`} style={indent ? { paddingLeft: 14 } : undefined}>
      <span>{label}</span>
      <span>{fmt(value)}</span>
    </div>
  );
}

export default function FinancialsPage() {
  const [lookups, setLookups] = useState({ stores: [] });
  const [from, setFrom] = useState(firstOfMonthLocal);
  const [to, setTo] = useState(todayLocal);
  const [store, setStore] = useState("all");
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [tab, setTab] = useState("income");

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/lookups").then((r) => r.json()).then((d) => {
      if (d.ok) setLookups(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ from, to, store, includeDrafts: String(includeDrafts) });
    fetch(`/api/financials?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        else setError(d.error || "Could not load financial statements.");
      })
      .catch(() => setError("Could not reach the server."));
  }, [from, to, store, includeDrafts]);

  return (
    <main className="page">
      <h2 className="page-title">Financial Statements</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-grid-3">
          <div className="field">
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label>Store</label>
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">All stores</option>
              {lookups.stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="checkbox-row" style={{ margin: "10px 0 0" }}>
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} />
          Include draft entries
        </div>
      </div>

      <div className="tabs">
        {["income", "balance", "equity", "cashflow"].map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {{ income: "Income", balance: "Position", equity: "Equity", cashflow: "Cash Flow" }[t]}
          </button>
        ))}
      </div>

      {error && <div className="toast error">{error}</div>}
      {!data && !error && <div className="summary">Loading…</div>}

      {data && tab === "income" && (
        <div className="card">
          <p className="fs-period">For the period {data.from} to {data.to}{store !== "all" ? ` — ${lookups.stores.find((s) => s.id === store)?.name || ""}` : ""}</p>
          <p className="fs-section">Revenue</p>
          {data.incomeStatement.revenueRows.length === 0 && <p className="fs-empty">No revenue in this period.</p>}
          {data.incomeStatement.revenueRows.map((r) => <Row key={r.name} label={r.name} value={r.value} indent />)}
          <Row label="Total Revenue" value={data.incomeStatement.totalRevenue} bold />

          <p className="fs-section">Expenses</p>
          {data.incomeStatement.expenseRows.length === 0 && <p className="fs-empty">No expenses in this period.</p>}
          {data.incomeStatement.expenseRows.map((r) => <Row key={r.name} label={r.name} value={r.value} indent />)}
          <Row label="Total Expenses" value={data.incomeStatement.totalExpense} bold />

          <div className="fs-divider" />
          <Row label="Net Income" value={data.incomeStatement.netIncome} bold />
        </div>
      )}

      {data && tab === "balance" && (
        <div className="card">
          <p className="fs-period">As of {data.to}{store !== "all" ? ` — ${lookups.stores.find((s) => s.id === store)?.name || ""}` : ""}</p>
          <p className="fs-section">Assets</p>
          {data.balanceSheet.assetRows.map((r) => <Row key={r.name} label={r.name} value={r.value} indent />)}
          <Row label="Total Assets" value={data.balanceSheet.totalAssets} bold />

          <p className="fs-section">Liabilities</p>
          {data.balanceSheet.liabilityRows.map((r) => <Row key={r.name} label={r.name} value={r.value} indent />)}
          <Row label="Total Liabilities" value={data.balanceSheet.totalLiabilities} bold />

          <p className="fs-section">Equity</p>
          {data.balanceSheet.equityRows.map((r) => <Row key={r.name} label={r.name} value={r.value} indent />)}
          <Row label="Total Equity" value={data.balanceSheet.totalEquity} bold />

          <div className="fs-divider" />
          <Row label="Liabilities + Equity" value={data.balanceSheet.totalLiabilities + data.balanceSheet.totalEquity} bold />
          <p className={`fs-check ${data.balanceSheet.balanced ? "ok" : "error"}`}>
            {data.balanceSheet.balanced ? "✓ Balanced — Assets match Liabilities + Equity" : "⚠ Out of balance — check recent entries"}
          </p>
        </div>
      )}

      {data && tab === "equity" && (
        <div className="card">
          <p className="fs-period">For the period {data.from} to {data.to}</p>
          <div className="fs-row fs-row-header">
            <span>Account</span>
            <span>Opening</span>
            <span>Movement</span>
            <span>Closing</span>
          </div>
          {data.equityStatement.map((e) => (
            <div className="fs-row fs-row-4" key={e.name}>
              <span>{e.name}</span>
              <span>{fmt(e.opening)}</span>
              <span>{fmt(e.movement)}</span>
              <span>{fmt(e.closing)}</span>
            </div>
          ))}
          <div className="fs-divider" />
          <div className="fs-row fs-row-4 fs-row-bold">
            <span>Total Equity</span>
            <span>{fmt(data.equityStatement.reduce((s, e) => s + e.opening, 0))}</span>
            <span>{fmt(data.equityStatement.reduce((s, e) => s + e.movement, 0))}</span>
            <span>{fmt(data.equityStatement.reduce((s, e) => s + e.closing, 0))}</span>
          </div>
        </div>
      )}

      {data && tab === "cashflow" && (
        <div className="card">
          <p className="fs-period">For the period {data.from} to {data.to}</p>

          <p className="fs-section">Operating Activities</p>
          {data.cashFlow.operating.length === 0 && <p className="fs-empty">No operating cash flow in this period.</p>}
          {data.cashFlow.operating.map((r) => <Row key={r.label} label={r.label} value={r.value} indent />)}
          <Row label="Net Cash from Operating" value={data.cashFlow.operatingTotal} bold />

          {data.cashFlow.investing.length > 0 && (
            <>
              <p className="fs-section">Investing Activities</p>
              {data.cashFlow.investing.map((r) => <Row key={r.label} label={r.label} value={r.value} indent />)}
              <Row label="Net Cash from Investing" value={data.cashFlow.investingTotal} bold />
            </>
          )}

          {data.cashFlow.financing.length > 0 && (
            <>
              <p className="fs-section">Financing Activities</p>
              {data.cashFlow.financing.map((r) => <Row key={r.label} label={r.label} value={r.value} indent />)}
              <Row label="Net Cash from Financing" value={data.cashFlow.financingTotal} bold />
            </>
          )}

          <div className="fs-divider" />
          <Row label="Net Change in Cash" value={data.cashFlow.netChange} bold />
          <Row label="Beginning Cash Balance" value={data.cashFlow.beginningCash} />
          <Row label="Ending Cash Balance" value={data.cashFlow.endingCash} bold />
        </div>
      )}
    </main>
  );
}
