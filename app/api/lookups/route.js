import { readRows } from "../../../lib/sheets";

export async function GET() {
  try {
    const [stores, customers, vendors, coa] = await Promise.all([
      readRows("store!A2:C"),
      readRows("customer!A2:E"),
      readRows("vendor!A2:D"),
      readRows("coa!A2:D"),
    ]);
    return Response.json({
      ok: true,
      stores: stores
        .filter((r) => r[2] !== "inactive")
        .map((r) => ({ id: r[0], name: r[1] })),
      customers: customers.map((r) => ({ id: r[0], name: r[1] })),
      vendors: vendors.map((r) => ({ id: r[0], name: r[1] })),
      accounts: coa.map((r) => ({ id: r[0], name: r[1], accountType: r[2], accountClass: r[3] })),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
