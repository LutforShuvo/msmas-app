"use client";

import { useEffect, useMemo, useState } from "react";

function fmt(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  return `${sign}৳${Math.abs(v).toLocaleString()}`;
}

const GROUP_ORDER = ["Asset", "Liability", "Equity", "Revenue", "Expense", "Customer", "Vendor"];

export default function StatementPage() {
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState(null);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // { kind, id, name }
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setOverview(d.items);
        else setOverviewError(d.error || "Could not load accounts.");
      })
      .catch(() => setOverviewError("Could not reach the server."));
  }, []);

  const options = useMemo(() => {
    if (!query || !overview) return [];
    const q = query.toLowerCase();
    return overview.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, overview]);

  const grouped = useMemo(() => {
    if (!overview) return [];
    const groups = {};
    for (const item of overview) {
      const g = item.accountType;
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => ({ type: g, items: groups[g] }));
  }, [overview]);

  function pick(opt) {
    setSelected(opt);
    setQuery(opt.name);
  }

  function backToOverview() {
    setSelected(null);
    setQuery("");
    setData(null);
    setFrom("");
    setTo("");
  }

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ kind: selected.kind, id: selected.id, from, to });
    fetch(`/api/statement?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        else setError(d.error || "Could not load statement.");
      })
      .catch(() => setError("Could not reach the server."))
      .finally(() => setLoading(false));
  }, [selected, from, to]);

  return (
    <main className="page">
      <h2 className="page-title">Account Statement</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field" style={{ position: "relative", marginBottom: 0 }}>
          <label>Search account, customer, or vendor</label>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setData(null);
            }}
            placeholder="e.g. Hasan account, Fahim Karim…"
          />
          {query && !selected && options.length > 0 && (
            <div className="search-dropdown">
              {options.map((o) => (
                <button key={`${o.kind}-${o.id}`} onClick={() => pick(o)}>
                  <span>{o.name}</span>
                  <span className="search-sub">{o.accountType}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="row-2" style={{ marginTop: 14 }}>
            <div className="field">
              <label>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field">
              <label>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {!selected && (
        <>
          {overviewError && <div className="toast error">{overviewError}</div>}
          {!overview && !overviewError && <div className="summary">Loading balances…</div>}
          {grouped.map((g) => (
            <div className="card" style={{ marginBottom: 12 }} key={g.type}>
              <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 10px" }}>{g.type}</p>
              <table className="entry-lines">
                <tbody>
                  {g.items.map((item) => (
                    <tr
                      key={`${item.kind}-${item.id}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => pick(item)}
                    >
                      <td>{item.name}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{fmt(item.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {selected && (
        <>
          <button className="link-btn" style={{ marginBottom: 10 }} onClick={backToOverview}>
            ← All accounts
          </button>
          {error && <div className="toast error">{error}</div>}
          {loading && <div className="summary">Loading…</div>}

          {data && !loading && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 2px" }}>Opening balance</p>
                  <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{fmt(data.openingBalance)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 2px" }}>Closing balance</p>
                  <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{fmt(data.closingBalance)}</p>
                </div>
              </div>

              {data.rows.length === 0 ? (
                <p className="summary">No transactions in this date range.</p>
              ) : (
                <table className="entry-lines">
                  <thead>
                    <tr>
                      <td className="muted">Date</td>
                      <td className="muted">Description</td>
                      <td className="muted num">Debit</td>
                      <td className="muted num">Credit</td>
                      <td className="muted num">Balance</td>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td>{r.desc}</td>
                        <td className="num">{r.debit ? r.debit.toLocaleString() : ""}</td>
                        <td className="num">{r.credit ? r.credit.toLocaleString() : ""}</td>
                        <td className="num" style={{ fontWeight: 500 }}>{fmt(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
