import { readRows } from "../../../lib/sheets";
import { toNumber, sheetDateToISO } from "../../../lib/format";

export const dynamic = "force-dynamic"; // never cache — always read the live Sheet

function monthKey(iso) {
  return iso ? iso.slice(0, 7) : "";
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short" });
}
function lastNMonthKeys(endISO, n) {
  const end = endISO ? new Date(endISO) : new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const today = new Date().toISOString().slice(0, 10);
    const from = searchParams.get("from") || today.slice(0, 8) + "01";
    const to = searchParams.get("to") || today;
    const storeFilter = searchParams.get("store") || "all";
    const typeFilter = searchParams.get("type") || "all";
    const includeDrafts = searchParams.get("includeDrafts") === "true";

    const [txns, lines, coa, stores] = await Promise.all([
      readRows("transaction!A2:G"),
      readRows("line!A2:J"),
      readRows("coa!A2:D"),
      readRows("store!A2:C"),
    ]);

    const txnMeta = {};
    const allTypes = new Set();
    for (const t of txns) {
      txnMeta[t[0]] = { date: sheetDateToISO(t[1]), type: t[2], status: t[6] || "" };
      if (t[2]) allTypes.add(t[2]);
    }
    const acctById = {};
    for (const a of coa) acctById[a[0]] = { name: a[1], type: a[2], class: a[3] };
    const storeById = {};
    for (const s of stores) storeById[s[0]] = s[1];

    function passesFilters(l) {
      const meta = txnMeta[l[1]];
      if (!meta) return false;
      if (!includeDrafts && meta.status !== "posted") return false;
      if (storeFilter !== "all" && l[4] !== storeFilter) return false;
      if (typeFilter !== "all" && meta.type !== typeFilter) return false;
      return true;
    }

    const enriched = lines.filter(passesFilters).map((l) => {
      const meta = txnMeta[l[1]];
      const acct = acctById[l[2]] || {};
      return {
        date: meta.date,
        accountId: l[2],
        accountType: acct.type,
        accountClass: acct.class,
        storeId: l[4],
        debit: toNumber(l[5]),
        credit: toNumber(l[6]),
      };
    });

    const inRange = (d) => (!from || d >= from) && (!to || d <= to);

    let revenue = 0, expense = 0;
    const expenseByAccount = {};
    const revenueByStore = {};
    for (const l of enriched) {
      if (!inRange(l.date)) continue;
      if (l.accountType === "Revenue") {
        const net = l.credit - l.debit;
        revenue += net;
        revenueByStore[l.storeId] = (revenueByStore[l.storeId] || 0) + net;
      } else if (l.accountType === "Expense") {
        const net = l.debit - l.credit;
        expense += net;
        expenseByAccount[l.accountId] = (expenseByAccount[l.accountId] || 0) + net;
      }
    }

    let cashBank = 0;
    for (const l of enriched) {
      if (to && l.date > to) continue;
      if (l.accountClass === "Cash & Cash Equivalent" || l.accountClass === "Bank") {
        cashBank += l.debit - l.credit;
      }
    }

    const months = lastNMonthKeys(to, 6);
    const trendMap = {};
    for (const k of months) trendMap[k] = { revenue: 0, expense: 0 };
    for (const l of enriched) {
      const mk = monthKey(l.date);
      if (!trendMap[mk]) continue;
      if (l.accountType === "Revenue") trendMap[mk].revenue += l.credit - l.debit;
      else if (l.accountType === "Expense") trendMap[mk].expense += l.debit - l.credit;
    }
    const trend = months.map((k) => ({ label: monthLabel(k), revenue: trendMap[k].revenue, expense: trendMap[k].expense }));

    const expenseBreakdown = Object.entries(expenseByAccount)
      .map(([id, value]) => ({ name: (acctById[id] || {}).name || id, value }))
      .sort((a, b) => b.value - a.value);
    const topExpenses = expenseBreakdown.slice(0, 5);
    const otherExpense = expenseBreakdown.slice(5).reduce((s, e) => s + e.value, 0);
    if (otherExpense > 0) topExpenses.push({ name: "Other", value: otherExpense });

    const revByStore = Object.entries(revenueByStore)
      .map(([id, value]) => ({ name: storeById[id] || id, value }))
      .sort((a, b) => b.value - a.value);

    return Response.json({
      ok: true,
      from,
      to,
      kpis: { revenue, expense, net: revenue - expense, cashBank },
      trend,
      expenseBreakdown: topExpenses,
      revenueByStore: revByStore,
      types: [...allTypes],
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
