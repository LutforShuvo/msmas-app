import { readRows } from "../../../lib/sheets";
import { toNumber } from "../../../lib/format";

export const dynamic = "force-dynamic"; // never cache — always read the live Sheet

const CREDIT_NORMAL_TYPES = new Set(["Liability", "Equity", "Revenue"]);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDrafts = searchParams.get("includeDrafts") === "true";

    const [txns, lines, coa, customers, vendors] = await Promise.all([
      readRows("transaction!A2:G"),
      readRows("line!A2:J"),
      readRows("coa!A2:D"),
      readRows("customer!A2:E"),
      readRows("vendor!A2:D"),
    ]);

    const txnStatus = {};
    for (const t of txns) txnStatus[t[0]] = t[6] || "";

    const postedLines = lines.filter((l) => includeDrafts || txnStatus[l[1]] === "posted");

    const accountBalances = {};
    const customerBalances = {};
    const vendorBalances = {};
    for (const l of postedLines) {
      const net = toNumber(l[5]) - toNumber(l[6]);
      const accountId = l[2];
      accountBalances[accountId] = (accountBalances[accountId] || 0) + net;
      if (l[7] === "Customer") customerBalances[l[8]] = (customerBalances[l[8]] || 0) + net;
      if (l[7] === "Vendor") vendorBalances[l[8]] = (vendorBalances[l[8]] || 0) + net;
    }

    const accounts = coa
      .map((r) => {
        const flip = CREDIT_NORMAL_TYPES.has(r[2]);
        const raw = accountBalances[r[0]] || 0;
        return { kind: "account", id: r[0], name: r[1], accountType: r[2], balance: flip ? -raw : raw };
      })
      .filter((a) => a.balance !== 0 || accountBalances[a.id] !== undefined);

    const custList = customers.map((r) => ({
      kind: "customer",
      id: r[0],
      name: r[1],
      accountType: "Customer",
      balance: customerBalances[r[0]] || 0,
    }));

    const vendList = vendors.map((r) => ({
      kind: "vendor",
      id: r[0],
      name: r[1],
      accountType: "Vendor",
      balance: -(vendorBalances[r[0]] || 0),
    }));

    return Response.json({ ok: true, items: [...accounts, ...custList, ...vendList] });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
