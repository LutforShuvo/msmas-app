import { readRows } from "../../../lib/sheets";
import { toNumber, sheetDateToISO } from "../../../lib/format";
import { resolveControlAccounts } from "../../../lib/accounts";

const CASH_CLASSES = new Set(["Bank", "Cash & Cash Equivalent"]);

function bucketForCashMove(otherLines, arId, apId) {
  // otherLines: the non-cash sibling lines in the same transaction.
  // Returns { section, label } describing what this cash movement was for.
  if (!otherLines.length) return null; // pure cash-to-cash transfer — nets to zero, excluded
  const primary = otherLines[0];
  if (primary.accountType === "Revenue") return { section: "Operating", label: "Cash from Sales" };
  if (primary.accountType === "Expense") return { section: "Operating", label: "Cash paid for Expenses & Purchases" };
  if (primary.accountId === arId) return { section: "Operating", label: "Received from Customers" };
  if (primary.accountId === apId) return { section: "Operating", label: "Paid to Suppliers" };
  if (primary.accountType === "Liability") return { section: "Financing", label: "Loan Proceeds / Repayments" };
  if (primary.accountType === "Equity") return { section: "Financing", label: "Owner Contributions / Withdrawals" };
  if (primary.accountType === "Asset") return { section: "Investing", label: "Purchase / Sale of Fixed Assets" };
  return { section: "Operating", label: "Other" };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const today = new Date().toISOString().slice(0, 10);
    const from = searchParams.get("from") || today.slice(0, 8) + "01";
    const to = searchParams.get("to") || today;
    const storeFilter = searchParams.get("store") || "all";
    const includeDrafts = searchParams.get("includeDrafts") === "true";

    const [txns, lines, coa] = await Promise.all([
      readRows("transaction!A2:G"),
      readRows("line!A2:J"),
      readRows("coa!A2:D"),
    ]);

    const txnMeta = {};
    for (const t of txns) txnMeta[t[0]] = { date: sheetDateToISO(t[1]), status: t[6] || "" };
    const acctById = {};
    for (const a of coa) acctById[a[0]] = { name: a[1], type: a[2], class: a[3] };
    const { ar, ap } = resolveControlAccounts(coa);
    const arId = ar?.id;
    const apId = ap?.id;

    const passes = (l) => {
      const meta = txnMeta[l[1]];
      if (!meta) return false;
      if (!includeDrafts && meta.status !== "posted") return false;
      if (storeFilter !== "all" && l[4] !== storeFilter) return false;
      return true;
    };

    const enriched = lines.filter(passes).map((l) => {
      const meta = txnMeta[l[1]];
      const acct = acctById[l[2]] || {};
      return {
        txnId: l[1],
        date: meta.date,
        accountId: l[2],
        accountType: acct.type,
        accountClass: acct.class,
        name: acct.name || l[2],
        debit: toNumber(l[5]),
        credit: toNumber(l[6]),
      };
    });

    const inPeriod = (d) => (!from || d >= from) && (!to || d <= to);
    const upTo = (d, end) => !end || d <= end;
    const before = (d, start) => !start || d < start;

    // ---------- Income Statement (within period) ----------
    const revByAcct = {}, expByAcct = {};
    for (const l of enriched) {
      if (!inPeriod(l.date)) continue;
      if (l.accountType === "Revenue") revByAcct[l.accountId] = revByAcct[l.accountId] || { name: l.name, value: 0 };
      if (l.accountType === "Revenue") revByAcct[l.accountId].value += l.credit - l.debit;
      if (l.accountType === "Expense") expByAcct[l.accountId] = expByAcct[l.accountId] || { name: l.name, value: 0 };
      if (l.accountType === "Expense") expByAcct[l.accountId].value += l.debit - l.credit;
    }
    const revenueRows = Object.values(revByAcct).sort((a, b) => b.value - a.value);
    const expenseRows = Object.values(expByAcct).sort((a, b) => b.value - a.value);
    const totalRevenue = revenueRows.reduce((s, r) => s + r.value, 0);
    const totalExpense = expenseRows.reduce((s, r) => s + r.value, 0);
    const netIncome = totalRevenue - totalExpense;

    // ---------- Balance Sheet (cumulative as of "to") ----------
    const assetByAcct = {}, liabByAcct = {}, equityByAcct = {};
    let cumRevToDate = 0, cumExpToDate = 0;
    for (const l of enriched) {
      if (!upTo(l.date, to)) continue;
      if (l.accountType === "Asset") {
        assetByAcct[l.accountId] = assetByAcct[l.accountId] || { name: l.name, value: 0 };
        assetByAcct[l.accountId].value += l.debit - l.credit;
      } else if (l.accountType === "Liability") {
        liabByAcct[l.accountId] = liabByAcct[l.accountId] || { name: l.name, value: 0 };
        liabByAcct[l.accountId].value += l.credit - l.debit;
      } else if (l.accountType === "Equity") {
        equityByAcct[l.accountId] = equityByAcct[l.accountId] || { name: l.name, value: 0 };
        equityByAcct[l.accountId].value += l.credit - l.debit;
      } else if (l.accountType === "Revenue") {
        cumRevToDate += l.credit - l.debit;
      } else if (l.accountType === "Expense") {
        cumExpToDate += l.debit - l.credit;
      }
    }
    const assetRows = Object.values(assetByAcct).sort((a, b) => b.value - a.value);
    const liabilityRows = Object.values(liabByAcct).sort((a, b) => b.value - a.value);
    const equityRows = Object.values(equityByAcct).sort((a, b) => b.value - a.value);
    const currentEarnings = cumRevToDate - cumExpToDate;
    const totalAssets = assetRows.reduce((s, r) => s + r.value, 0);
    const totalLiabilities = liabilityRows.reduce((s, r) => s + r.value, 0);
    const totalEquity = equityRows.reduce((s, r) => s + r.value, 0) + currentEarnings;

    // ---------- Statement of Changes in Equity ----------
    const equityMovement = {};
    for (const l of enriched) {
      if (l.accountType !== "Equity") continue;
      equityMovement[l.accountId] = equityMovement[l.accountId] || { name: l.name, opening: 0, movement: 0, closing: 0 };
      const net = l.credit - l.debit;
      if (before(l.date, from)) equityMovement[l.accountId].opening += net;
      if (inPeriod(l.date)) equityMovement[l.accountId].movement += net;
    }
    Object.values(equityMovement).forEach((e) => (e.closing = e.opening + e.movement));
    let retOpening = 0;
    for (const l of enriched) {
      if (!before(l.date, from)) continue;
      if (l.accountType === "Revenue") retOpening += l.credit - l.debit;
      if (l.accountType === "Expense") retOpening -= l.debit - l.credit;
    }
    const equityStatementRows = [
      ...Object.values(equityMovement).sort((a, b) => b.closing - a.closing),
      { name: "Retained Earnings (cumulative profit)", opening: retOpening, movement: netIncome, closing: retOpening + netIncome },
    ];

    // ---------- Cash Flow Statement ----------
    let beginningCash = 0;
    for (const l of enriched) {
      if (!CASH_CLASSES.has(l.accountClass)) continue;
      if (before(l.date, from)) beginningCash += l.debit - l.credit;
    }
    const linesByTxn = {};
    for (const l of enriched) {
      if (!linesByTxn[l.txnId]) linesByTxn[l.txnId] = [];
      linesByTxn[l.txnId].push(l);
    }
    const cfBuckets = {};
    for (const l of enriched) {
      if (!CASH_CLASSES.has(l.accountClass)) continue;
      if (!inPeriod(l.date)) continue;
      const siblings = linesByTxn[l.txnId].filter((x) => x !== l && !CASH_CLASSES.has(x.accountClass));
      const bucket = bucketForCashMove(siblings, arId, apId);
      if (!bucket) continue; // internal transfer between own accounts — nets to zero
      const key = `${bucket.section}::${bucket.label}`;
      cfBuckets[key] = cfBuckets[key] || { ...bucket, value: 0 };
      cfBuckets[key].value += l.debit - l.credit;
    }
    const cfRows = Object.values(cfBuckets).filter((b) => Math.round(b.value) !== 0);
    const bySection = { Operating: [], Investing: [], Financing: [] };
    cfRows.forEach((r) => bySection[r.section]?.push(r));
    const sectionTotal = (rows) => rows.reduce((s, r) => s + r.value, 0);
    const netChange = cfRows.reduce((s, r) => s + r.value, 0);
    const endingCash = beginningCash + netChange;

    return Response.json({
      ok: true,
      from,
      to,
      incomeStatement: { revenueRows, expenseRows, totalRevenue, totalExpense, netIncome },
      balanceSheet: {
        assetRows, liabilityRows,
        equityRows: [...equityRows, { name: "Retained Earnings (cumulative profit)", value: currentEarnings }],
        totalAssets, totalLiabilities, totalEquity,
        balanced: Math.round(totalAssets - (totalLiabilities + totalEquity)) === 0,
      },
      equityStatement: equityStatementRows,
      cashFlow: {
        beginningCash, endingCash, netChange,
        operating: bySection.Operating, investing: bySection.Investing, financing: bySection.Financing,
        operatingTotal: sectionTotal(bySection.Operating),
        investingTotal: sectionTotal(bySection.Investing),
        financingTotal: sectionTotal(bySection.Financing),
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
