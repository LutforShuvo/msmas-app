import { readRows } from "../../../lib/sheets";
import { toNumber, sheetDateToISO } from "../../../lib/format";

// kind: "account" | "customer" | "vendor"
// Accounts with a normal CREDIT balance (Liability, Equity, Revenue) and
// vendors (money we owe) are displayed with the sign flipped, so a
// positive number always reads as "in your favor" for that row's owner —
// matches the accounts overview page (AR positive = owed to you, AP
// positive = you owe).
const CREDIT_NORMAL_TYPES = new Set(["Liability", "Equity", "Revenue"]);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");
    const id = searchParams.get("id");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const includeDrafts = searchParams.get("includeDrafts") === "true";

    if (!kind || !id) {
      return Response.json({ ok: false, error: "Missing kind or id" }, { status: 400 });
    }

    const [txns, lines, coa] = await Promise.all([
      readRows("transaction!A2:G"),
      readRows("line!A2:J"),
      readRows("coa!A2:D"),
    ]);

    const txnDate = {};
    const txnNote = {};
    const txnStatus = {};
    for (const t of txns) {
      txnDate[t[0]] = sheetDateToISO(t[1]);
      txnNote[t[0]] = t[3] || t[2] || "";
      txnStatus[t[0]] = t[6] || "";
    }

    let label = id;
    let flip = false;
    if (kind === "account") {
      const acct = coa.find((r) => r[0] == id);
      if (acct) {
        label = acct[1];
        flip = CREDIT_NORMAL_TYPES.has(acct[2]);
      }
    } else if (kind === "vendor") {
      flip = true; // amounts owed to vendors read as positive
    }

    const matching = lines
      .filter((l) =>
        kind === "account"
          ? l[2] == id
          : l[7] === (kind === "customer" ? "Customer" : "Vendor") && l[8] === id
      )
      .filter((l) => includeDrafts || txnStatus[l[1]] === "posted")
      .map((l) => ({
        txnId: l[1],
        date: txnDate[l[1]] || "",
        desc: l[9] || txnNote[l[1]] || "",
        debit: toNumber(l[5]),
        credit: toNumber(l[6]),
      }))
      .filter((l) => l.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    let opening = 0;
    for (const l of matching) {
      if (from && l.date < from) opening += l.debit - l.credit;
    }

    const inRange = matching.filter(
      (l) => (!from || l.date >= from) && (!to || l.date <= to)
    );

    let running = opening;
    const rows = inRange.map((l) => {
      running += l.debit - l.credit;
      return { ...l, balance: flip ? -running : running };
    });

    return Response.json({
      ok: true,
      label,
      openingBalance: flip ? -opening : opening,
      closingBalance: rows.length ? rows[rows.length - 1].balance : (flip ? -opening : opening),
      rows,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
