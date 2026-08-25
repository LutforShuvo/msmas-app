import { readRows, updateRow, clearRanges, appendRows } from "../../../lib/sheets";
import { toNumber, sheetDateToISO } from "../../../lib/format";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";

export const dynamic = "force-dynamic"; // never cache — always read the live Sheet

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const txnId = searchParams.get("txnId");
    if (!txnId) return Response.json({ ok: false, error: "Missing txnId" }, { status: 400 });

    const [txnRows, lineRows] = await Promise.all([
      readRows("transaction!A2:G"),
      readRows("line!A2:J"),
    ]);

    const idx = txnRows.findIndex((r) => r[0] === txnId);
    if (idx === -1) return Response.json({ ok: false, error: "Transaction not found" }, { status: 404 });
    const t = txnRows[idx];

    const lines = lineRows
      .filter((l) => l[1] === txnId)
      .map((l) => ({
        accountId: String(l[2]),
        storeId: l[4],
        debit: toNumber(l[5]),
        credit: toNumber(l[6]),
        partyType: l[7] || "",
        partyId: l[8] || "",
      }));

    return Response.json({
      ok: true,
      transaction: {
        txnId: t[0],
        date: sheetDateToISO(t[1]),
        type: t[2],
        note: t[3] || "",
        status: t[6] || "",
        lines,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || !["admin", "entry"].includes(session.user.role)) {
      return Response.json({ ok: false, error: "You don't have permission to edit entries." }, { status: 403 });
    }

    const body = await req.json();
    const { txnId, date, note, status, lines } = body;
    if (!txnId || !Array.isArray(lines) || lines.length < 2) {
      return Response.json({ ok: false, error: "A transaction needs at least 2 lines" }, { status: 400 });
    }
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      return Response.json(
        { ok: false, error: `Debit total ${totalDebit} does not match credit total ${totalCredit}` },
        { status: 400 }
      );
    }

    const [txnRows, lineRows, coaRows] = await Promise.all([
      readRows("transaction!A2:G"),
      readRows("line!A2:J"),
      readRows("coa!A2:D"),
    ]);
    const nameFor = (id) => (coaRows.find((r) => String(r[0]) === String(id)) || {})[1] || id;

    const txnIdx = txnRows.findIndex((r) => r[0] === txnId);
    if (txnIdx === -1) return Response.json({ ok: false, error: "Transaction not found" }, { status: 404 });
    const existing = txnRows[txnIdx];
    const sheetRow = txnIdx + 2; // +2: header row + 1-indexing

    const oldLineRowNumbers = [];
    lineRows.forEach((l, i) => {
      if (l[1] === txnId) oldLineRowNumbers.push(i + 2);
    });

    const newLines = lines.map((l, i) => [
      `${txnId}-L${i + 1}`,
      txnId,
      l.accountId,
      nameFor(l.accountId),
      l.storeId,
      l.debit || "",
      l.credit || "",
      l.partyType || "",
      l.partyId || "",
      "",
    ]);

    // These three writes touch different rows/ranges and don't depend on
    // each other's results — running them together instead of one after
    // another cuts real time off every edit.
    await Promise.all([
      updateRow(`transaction!A${sheetRow}:G${sheetRow}`, [
        existing[0], date, existing[2], note || "", existing[4], existing[5], status,
      ]),
      oldLineRowNumbers.length
        ? clearRanges(oldLineRowNumbers.map((r) => `line!A${r}:J${r}`))
        : Promise.resolve(),
      appendRows("line!A:J", newLines),
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
