import { appendRows } from "../../../lib/sheets";
import {
  AR_ACCOUNT,
  SALES_REVENUE,
  HEAD_OFFICE_STORE_ID,
  TXN_TYPE_LABEL,
  resolveAccountName,
} from "../../../lib/schema";

function newId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 100)}`;
}

// A "line" here is [line_id, txn_id, account_id, account_name, store_id,
// debit_amount, credit_amount, party_type, party_id, note] — matches the
// `line` tab column order exactly (account_name is written as plain text,
// not the sheet's formula, since we already know it here).
function buildLine(txnId, { accountId, storeId, debit = 0, credit = 0, partyType = "", partyId = "", note = "" }) {
  return [
    newId("L"),
    txnId,
    accountId,
    resolveAccountName(accountId),
    storeId,
    debit || "",
    credit || "",
    partyType,
    partyId,
    note,
  ];
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { type, date, note, userId } = body;
    const txnId = newId("T");
    const now = new Date().toISOString();
    let lines = [];

    if (type === "sale") {
      const { store, amount, onCredit, method, customerId } = body;
      lines.push(
        buildLine(txnId, {
          accountId: onCredit ? AR_ACCOUNT.id : method,
          storeId: store,
          debit: amount,
          partyType: onCredit ? "Customer" : "",
          partyId: onCredit ? customerId : "",
        })
      );
      lines.push(
        buildLine(txnId, { accountId: SALES_REVENUE.id, storeId: store, credit: amount })
      );
    } else if (type === "expense") {
      const { category, amount, method, shared, store, splits } = body;
      if (shared) {
        const total = splits.reduce((s, r) => s + Number(r.amount || 0), 0);
        if (total !== Number(amount)) {
          return Response.json(
            { ok: false, error: `Split totals ${total}, does not match amount ${amount}` },
            { status: 400 }
          );
        }
        splits.forEach((s) =>
          lines.push(buildLine(txnId, { accountId: category, storeId: s.store, debit: s.amount }))
        );
        lines.push(
          buildLine(txnId, { accountId: method, storeId: HEAD_OFFICE_STORE_ID, credit: amount })
        );
      } else {
        lines.push(buildLine(txnId, { accountId: category, storeId: store, debit: amount }));
        lines.push(buildLine(txnId, { accountId: method, storeId: store, credit: amount }));
      }
    } else if (type === "transfer") {
      const { from, to, amount } = body;
      lines.push(buildLine(txnId, { accountId: to, storeId: HEAD_OFFICE_STORE_ID, debit: amount }));
      lines.push(buildLine(txnId, { accountId: from, storeId: HEAD_OFFICE_STORE_ID, credit: amount }));
    } else {
      return Response.json({ ok: false, error: "Unknown transaction type" }, { status: 400 });
    }

    await appendRows("transaction!A:G", [
      [txnId, date, TXN_TYPE_LABEL[type], note || "", userId || "", now, "posted"],
    ]);
    await appendRows("line!A:J", lines);

    return Response.json({ ok: true, txnId });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
