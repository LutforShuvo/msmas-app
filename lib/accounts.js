// The app needs to know which account is "Sales Revenue," "Accounts
// Receivable," and "Accounts Payable" every time it builds a Sale, Expense,
// or Transfer entry. Rather than hardcoding their IDs (which breaks the
// moment the Sheet's numbering changes), we resolve them by name from the
// live coa data on every request — same principle as the rest of the app's
// dropdowns being pulled live instead of hardcoded.
//
// Matching is forgiving on purpose: it strips punctuation/extra words and
// accepts a partial match, so a cell like "1010 Accounts Receivable A/C"
// still resolves correctly, not just a byte-perfect "Accounts Receivable".
function normalize(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findAccount(coaRows, candidates) {
  for (const candidate of candidates) {
    const target = normalize(candidate);
    const exact = coaRows.find((r) => normalize(r[1]) === target);
    if (exact) return { id: String(exact[0]), name: exact[1] };
  }
  for (const candidate of candidates) {
    const target = normalize(candidate);
    if (target.length < 6) continue; // too short to safely substring-match (e.g. "ar" inside "Marketing")
    const partial = coaRows.find((r) => normalize(r[1]).includes(target));
    if (partial) return { id: String(partial[0]), name: partial[1] };
  }
  return null;
}

export function resolveControlAccounts(coaRows) {
  return {
    salesRevenue: findAccount(coaRows, ["Sales Revenue"]),
    ar: findAccount(coaRows, ["Accounts Receivable", "Account Receivable", "AR"]),
    ap: findAccount(coaRows, ["Accounts Payable", "Account Payable", "AP"]),
  };
}
