import { readRows } from "../../../lib/sheets";
import { toNumber, sheetDateToISO } from "../../../lib/format";

export const dynamic = "force-dynamic"; // never cache — always read the live Sheet

export async function GET() {
  try {
    const [txns, lines] = await Promise.all([
      readRows("transaction!A2:G"),
      readRows("line!A2:J"),
    ]);

    const linesByTxn = {};
    for (const l of lines) {
      const txnId = l[1];
      if (!linesByTxn[txnId]) linesByTxn[txnId] = [];
      linesByTxn[txnId].push({
        account: l[3] || l[2],
        store: l[4],
        debit: toNumber(l[5]),
        credit: toNumber(l[6]),
        note: l[9] || "",
      });
    }

    const entries = txns
      .filter((t) => t[0])
      .map((t) => ({
        txnId: t[0],
        date: sheetDateToISO(t[1]),
        type: t[2],
        note: t[3] || "",
        status: t[6] || "",
        lines: linesByTxn[t[0]] || [],
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 20);

    return Response.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
