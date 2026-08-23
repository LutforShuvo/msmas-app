import { readRows, updateRow } from "../../../lib/sheets";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";

export const dynamic = "force-dynamic"; // never cache — always read the live Sheet

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "admin") {
      return Response.json({ ok: false, error: "Only an admin can approve entries." }, { status: 403 });
    }

    const { txnId } = await req.json();
    if (!txnId) return Response.json({ ok: false, error: "Missing txnId" }, { status: 400 });

    const txnRows = await readRows("transaction!A2:G");
    const idx = txnRows.findIndex((r) => r[0] === txnId);
    if (idx === -1) return Response.json({ ok: false, error: "Transaction not found" }, { status: 404 });

    const row = txnRows[idx];
    const sheetRow = idx + 2;
    await updateRow(`transaction!A${sheetRow}:G${sheetRow}`, [
      row[0], row[1], row[2], row[3], row[4], row[5], "posted",
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
