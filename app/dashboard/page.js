"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

// Uses the browser's own local date, not UTC — fixes the range silently
// excluding "today" during Bangladesh's early morning hours when the
// server's UTC clock is still on the previous calendar day.
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

const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#898781"];

export default function DashboardPage() {
  const [lookups, setLookups] = useState({ stores: [] });
  const [from, setFrom] = useState(firstOfMonthLocal);
  const [to, setTo] = useState(todayLocal);
  const [store, setStore] = useState("all");
  const [type, setType] = useState("all");
  const [includeDrafts, setIncludeDrafts] = useState(false);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [chartReady, setChartReady] = useState(false);

  const trendRef = useRef(null);
  const expRef = useRef(null);
  const storeRef = useRef(null);
  const chartInstances = useRef({});

  useEffect(() => {
    fetch("/api/lookups").then((r) => r.json()).then((d) => {
      if (d.ok) setLookups(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ from, to, store, type, includeDrafts: String(includeDrafts) });
    fetch(`/api/dashboard?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        else setError(d.error || "Could not load dashboard data.");
      })
      .catch(() => setError("Could not reach the server."));
  }, [from, to, store, type, includeDrafts]);

  useEffect(() => {
    if (!chartReady || !data || !window.Chart) return;
    Object.values(chartInstances.current).forEach((c) => c && c.destroy());
    chartInstances.current = {};

    if (trendRef.current) {
      chartInstances.current.trend = new window.Chart(trendRef.current, {
        type: "line",
        data: {
          labels: data.trend.map((t) => t.label),
          datasets: [
            { label: "Revenue", data: data.trend.map((t) => Math.round(t.revenue)), borderColor: "#2a78d6", backgroundColor: "rgba(42,120,214,0.1)", fill: true, tension: 0.3, borderWidth: 2 },
            { label: "Expense", data: data.trend.map((t) => Math.round(t.expense)), borderColor: "#eb6834", backgroundColor: "rgba(235,104,52,0.1)", fill: true, tension: 0.3, borderWidth: 2, borderDash: [4, 3] },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: (v) => "৳" + v.toLocaleString() }, grid: { color: "#e1e0d9" } }, x: { grid: { display: false } } },
        },
      });
    }

    if (expRef.current && data.expenseBreakdown.length > 0) {
      chartInstances.current.exp = new window.Chart(expRef.current, {
        type: "doughnut",
        data: {
          labels: data.expenseBreakdown.map((e) => e.name),
          datasets: [{ data: data.expenseBreakdown.map((e) => Math.round(e.value)), backgroundColor: COLORS, borderColor: "#fcfcfb", borderWidth: 2 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    if (storeRef.current && data.revenueByStore.length > 0) {
      chartInstances.current.store = new window.Chart(storeRef.current, {
        type: "bar",
        data: {
          labels: data.revenueByStore.map((s) => s.name),
          datasets: [{ data: data.revenueByStore.map((s) => Math.round(s.value)), backgroundColor: "#2a78d6", borderRadius: 4, maxBarThickness: 28 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: (v) => "৳" + v.toLocaleString() }, grid: { color: "#e1e0d9" } }, x: { grid: { display: false } } },
        },
      });
    }
  }, [chartReady, data]);

  const expenseTotal = data ? data.expenseBreakdown.reduce((s, e) => s + e.value, 0) : 0;

  return (
    <main className="page">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" onLoad={() => setChartReady(true)} />
      <h2 className="page-title">Dashboard</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-grid">
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
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>
              {(data?.types || []).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="checkbox-row" style={{ margin: "10px 0 0" }}>
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} />
          Include draft entries
        </div>
      </div>

      {error && <div className="toast error">{error}</div>}
      {!data && !error && <div className="summary">Loading…</div>}

      {data && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <p className="kpi-label">Revenue</p>
              <p className="kpi-value">{fmt(data.kpis.revenue)}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Expenses</p>
              <p className="kpi-value">{fmt(data.kpis.expense)}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Net profit</p>
              <p className="kpi-value" style={{ color: data.kpis.net >= 0 ? "var(--success-text)" : "var(--danger-text)" }}>
                {fmt(data.kpis.net)}
              </p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Cash and bank</p>
              <p className="kpi-value">{fmt(data.kpis.cashBank)}</p>
              <p className="kpi-sub">as of {data.to}</p>
            </div>
          </div>

          <div className="card chart-card">
            <p className="chart-title">Revenue vs expense — last 6 months</p>
            <div className="chart-wrap"><canvas ref={trendRef} role="img" aria-label="Line chart of revenue and expense over the last six months"></canvas></div>
          </div>

          <div className="chart-row">
            <div className="card chart-card">
              <p className="chart-title">Expenses by category</p>
              {expenseTotal === 0 ? (
                <p className="summary">No expenses in this range.</p>
              ) : (
                <>
                  <div className="chart-wrap chart-wrap-sm"><canvas ref={expRef} role="img" aria-label="Donut chart of expenses by category"></canvas></div>
                  <div className="chart-legend">
                    {data.expenseBreakdown.map((e, i) => (
                      <span key={e.name}>
                        <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                        {e.name} {expenseTotal ? Math.round((e.value / expenseTotal) * 100) : 0}%
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="card chart-card">
              <p className="chart-title">Revenue by store</p>
              {data.revenueByStore.length === 0 ? (
                <p className="summary">No revenue in this range.</p>
              ) : (
                <div className="chart-wrap chart-wrap-sm"><canvas ref={storeRef} role="img" aria-label="Bar chart of revenue by store"></canvas></div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
