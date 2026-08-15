"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function fmt(n) {
  if (n === "" || n === undefined || n === 0) return "";
  return Number(n).toLocaleString();
}

export default function EntriesPage() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEntries(data.entries);
        else setError(data.error || "Could not load entries.");
      })
      .catch(() => setError("Could not reach the server."));
  }, []);

  return (
    <main className="page">
      <h2 className="page-title">Recent Entries</h2>
      {error && <div className="toast error">{error}</div>}
      {!entries && !error && <div className="summary">Loading…</div>}
      {entries && entries.length === 0 && <div className="summary">No entries yet.</div>}

      {entries && entries.map((e) => (
        <div className="card entry-card" key={e.txnId}>
          <div className="entry-head">
            <div>
              <span className="entry-type">{e.type}</span>
              <span className="entry-date">{e.date}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`entry-status ${e.status}`}>{e.status}</span>
              <Link href={`/entries/${e.txnId}/edit`} className="link-btn" style={{ fontSize: 12 }}>
                Edit
              </Link>
            </div>
          </div>
          {e.note && <p className="entry-note">{e.note}</p>}
          <table className="entry-lines">
            <tbody>
              {e.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.account}</td>
                  <td className="muted">{l.store}</td>
                  <td className="num">{fmt(l.debit)}</td>
                  <td className="num">{fmt(l.credit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </main>
  );
}
