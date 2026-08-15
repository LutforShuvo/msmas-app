// Google Sheets can hand back either raw values or formatted display
// strings depending on the read mode. These helpers make both safe to use,
// and convert Sheets' date serial numbers into plain ISO date strings.

export function toNumber(v) {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

// Sheets date serials are days since 1899-12-30 (UTC). 25569 is the
// number of days from that epoch to the Unix epoch (1970-01-01).
export function sheetDateToISO(v) {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  // Already a plain string — normalize common non-ISO formats defensively.
  const s = String(v).trim();
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (iso.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  return s;
}
