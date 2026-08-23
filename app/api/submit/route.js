import { appendRows, readRows } from "../../../lib/sheets";
import { HEAD_OFFICE_STORE_ID } from "../../../lib/schema";
import { resolveControlAccounts } from "../../../lib/accounts";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";

export const dynamic = "force-dynamic"; // never cache — always read the live Sheet

const TYPE_CODE = {
  Sale: "SAL",
  Expense: "EXP",
  "Bank Transfer": "TRF",
  Payment: "PAY",
  Receipt: "RCP",
};

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || !["admin", "entry"].includes(session.user.role)) {
      return Response.json({ ok: false, error: "You don't have permission to create entries." }, { status: 403 });
    }

    const body = await req.json();
    const { type, date, note } = body;
    const now = new Date().toISOString();

    const [coa, existingTxnRows] = await Promise.all([
      readRows("coa!A2:D"),
      readRows("transaction!A2:A"),
    ]);
    const nameFor = (id) => (coa.find((r) => String(r[0]) === String(id)) || {})[1] || id;
    const { salesRevenue, ar, ap } = resolveControlAccounts(coa);
    if (!salesRevenue || !ar || !ap) {
      const missing = [!salesRevenue && "Sales Revenue", !ar && "Accounts Receivable", !ap && "Accounts Payable"].filter(Boolean).join(", ");
      return Response.json(
        { ok: false, error: `Could not find "${missing}" in your coa tab — check the account name(s) match exactly.` },
        { status: 500 }
      );
    }

    // Figure out the real type label up front (Transfer's label depends on
    // what was picked), so the transaction ID can be built around it.
    let typeLabel;
    if (type === "sale") typeLabel = "Sale";
    else if (type === "expense") typeLabel = "Expense";
    else if (type === "transfer") {
      typeLabel = body.toKind === "vendor" ? "Payment" : body.fromKind === "customer" ? "Receipt" : "Bank Transfer";
    } else {
      return Response.json({ ok: false, error: "Unknown transaction type" }, { status: 400 });
    }

    // Meaningful, readable ID: e.g. EXP-20260816-01 — type, date, and the
    // Nth transaction of that type entered that day. Easy to recognize at
    // a glance in the Sheet instead of a random string.
    const dateCompact = (date || now.slice(0, 10)).replace(/-/g, "");
    const idPrefix = `${TYPE_CODE[typeLabel]}-${dateCompact}`;
    const existingIds = existingTxnRows.map((r) => r[0]).filter(Boolean);
    const sameDayCount = existingIds.filter((id) => id.startsWith(idPrefix)).length;
    const txnId = `${idPrefix}-${String(sameDayCount + 1).padStart(2, "0")}`;

    let lineCounter = 0;
    function buildLine({ accountId, accountName, storeId, debit = 0, credit = 0, partyType = "", partyId = "", note: lineNote }) {
      lineCounter += 1;
      return [
        `${txnId}-L${lineCounter}`,
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

    if (type === "sale") {
      const { store, amount, onCredit, method, customerId } = body;
      lines.push(
        buildLine({
          accountId: onCredit ? ar.id : method,
          accountName: onCredit ? ar.name : nameFor(method),
          storeId: store,
          debit: amount,
          partyType: onCredit ? "Customer" : "",
          partyId: onCredit ? customerId : "",
        })
      );
      lines.push(buildLine({ accountId: salesRevenue.id, accountName: salesRevenue.name, storeId: store, credit: amount }));
    } else if (type === "expense") {
      const { category, amount, onCredit, method, vendorId, shared, store, splits } = body;
      const creditBase = onCredit
        ? { accountId: ap.id, accountName: ap.name, partyType: "Vendor", partyId: vendorId }
        : { accountId: method, accountName: nameFor(method) };

      if (shared) {
        const total = splits.reduce((s, r) => s + Number(r.amount || 0), 0);
        if (total !== Number(amount)) {
          return Response.json({ ok: false, error: `Split totals ${total}, does not match amount ${amount}` }, { status: 400 });
        }
        // Both sides split the same way, store by store — so each store's
        // own books show their share of the expense AND their share of the
        // cash leaving, instead of the cash side landing only on Head Office.
        splits.forEach((s) =>
          lines.push(buildLine({ accountId: category, accountName: nameFor(category), storeId: s.store, debit: s.amount }))
        );
        splits.forEach((s) => lines.push(buildLine({ ...creditBase, storeId: s.store, credit: s.amount })));
      } else {
        lines.push(buildLine({ accountId: category, accountName: nameFor(category), storeId: store, debit: amount }));
        lines.push(buildLine({ ...creditBase, storeId: store, credit: amount }));
      }
    } else if (type === "transfer") {
      const { fromKind, fromId, toKind, toId, amount, store } = body;
      const txnStore = store || HEAD_OFFICE_STORE_ID;

      lines.push(
        toKind === "vendor"
          ? buildLine({ accountId: ap.id, accountName: ap.name, storeId: txnStore, debit: amount, partyType: "Vendor", partyId: toId })
          : buildLine({ accountId: toId, accountName: nameFor(toId), storeId: txnStore, debit: amount })
      );
      lines.push(
        fromKind === "customer"
          ? buildLine({ accountId: ar.id, accountName: ar.name, storeId: txnStore, credit: amount, partyType: "Customer", partyId: fromId })
          : buildLine({ accountId: fromId, accountName: nameFor(fromId), storeId: txnStore, credit: amount })
      );
    }

    await appendRows("transaction!A:G", [[txnId, date, typeLabel, note || "", session.user.userId || session.user.email, now, "draft"]]);
    await appendRows("line!A:J", lines);

    return Response.json({ ok: true, txnId });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
