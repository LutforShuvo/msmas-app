import { appendRows, readRows } from "../../../lib/sheets";
import { HEAD_OFFICE_STORE_ID } from "../../../lib/schema";
import { resolveControlAccounts } from "../../../lib/accounts";

function newId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 100)}`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { type, date, note, userId } = body;
    const txnId = newId("T");
    const now = new Date().toISOString();
    const coa = await readRows("coa!A2:D");
    const nameFor = (id) => (coa.find((r) => String(r[0]) === String(id)) || {})[1] || id;
    const { salesRevenue, ar, ap } = resolveControlAccounts(coa);
    if (!salesRevenue || !ar || !ap) {
      const missing = [!salesRevenue && "Sales Revenue", !ar && "Accounts Receivable", !ap && "Accounts Payable"].filter(Boolean).join(", ");
      return Response.json(
        { ok: false, error: `Could not find "${missing}" in your coa tab — check the account name(s) match exactly.` },
        { status: 500 }
      );
    }

    function buildLine(txnId, { accountId, accountName, storeId, debit = 0, credit = 0, partyType = "", partyId = "", note: lineNote }) {
      return [
        newId("L"),
        txnId,
        accountId,
        accountName || "",
        storeId || "",
        debit || "",
        credit || "",
        partyType,
        partyId,
        lineNote ?? note ?? "",
      ];
    }

    let lines = [];
    let typeLabel;

    if (type === "sale") {
      const { store, amount, onCredit, method, customerId } = body;
      typeLabel = "Sale";
      lines.push(
        buildLine(txnId, {
          accountId: onCredit ? ar.id : method,
          accountName: onCredit ? ar.name : nameFor(method),
          storeId: store,
          debit: amount,
          partyType: onCredit ? "Customer" : "",
          partyId: onCredit ? customerId : "",
        })
      );
      lines.push(
        buildLine(txnId, { accountId: salesRevenue.id, accountName: salesRevenue.name, storeId: store, credit: amount })
      );
    } else if (type === "expense") {
      const { category, amount, onCredit, method, vendorId, shared, store, splits } = body;
      typeLabel = "Expense";
      const creditLine = onCredit
        ? { accountId: ap.id, accountName: ap.name, partyType: "Vendor", partyId: vendorId }
        : { accountId: method, accountName: nameFor(method) };

      if (shared) {
        const total = splits.reduce((s, r) => s + Number(r.amount || 0), 0);
        if (total !== Number(amount)) {
          return Response.json({ ok: false, error: `Split totals ${total}, does not match amount ${amount}` }, { status: 400 });
        }
        splits.forEach((s) =>
          lines.push(buildLine(txnId, { accountId: category, accountName: nameFor(category), storeId: s.store, debit: s.amount }))
        );
        lines.push(buildLine(txnId, { ...creditLine, storeId: HEAD_OFFICE_STORE_ID, credit: amount }));
      } else {
        lines.push(buildLine(txnId, { accountId: category, accountName: nameFor(category), storeId: store, debit: amount }));
        lines.push(buildLine(txnId, { ...creditLine, storeId: store, credit: amount }));
      }
    } else if (type === "transfer") {
      const { fromKind, fromId, toKind, toId, amount, store } = body;
      const txnStore = store || HEAD_OFFICE_STORE_ID;

      if (toKind === "vendor") typeLabel = "Payment";
      else if (fromKind === "customer") typeLabel = "Receipt";
      else typeLabel = "Bank Transfer";

      lines.push(
        toKind === "vendor"
          ? buildLine(txnId, { accountId: ap.id, accountName: ap.name, storeId: txnStore, debit: amount, partyType: "Vendor", partyId: toId })
          : buildLine(txnId, { accountId: toId, accountName: nameFor(toId), storeId: txnStore, debit: amount })
      );
      lines.push(
        fromKind === "customer"
          ? buildLine(txnId, { accountId: ar.id, accountName: ar.name, storeId: txnStore, credit: amount, partyType: "Customer", partyId: fromId })
          : buildLine(txnId, { accountId: fromId, accountName: nameFor(fromId), storeId: txnStore, credit: amount })
      );
    } else {
      return Response.json({ ok: false, error: "Unknown transaction type" }, { status: 400 });
    }

    await appendRows("transaction!A:G", [[txnId, date, typeLabel, note || "", userId || "", now, "posted"]]);
    await appendRows("line!A:J", lines);

    return Response.json({ ok: true, txnId });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
