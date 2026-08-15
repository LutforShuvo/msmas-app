import { google } from "googleapis";

// Reads the service account JSON from an env var (pasted as a single-line
// string into Vercel's environment variables — see README).
function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env var");
  }
  return JSON.parse(raw);
}

export async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Appends rows to a tab. Range should be e.g. "transaction!A:G".
export async function appendRows(range, rows) {
  const sheets = await getSheetsClient();
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

// Reads a tab's rows (used for dropdown lookups and reports).
// UNFORMATTED_VALUE is important: without it, Sheets returns amounts as
// display strings like "15,000" and dates in the sheet locale's format
// instead of a plain date serial — both break downstream parsing.
export async function readRows(range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values || [];
}

// Overwrites a single row range, e.g. "transaction!A5:G5".
export async function updateRow(range, values) {
  const sheets = await getSheetsClient();
  return sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// Clears the contents of one or more row ranges without deleting the rows.
export async function clearRanges(ranges) {
  if (!ranges.length) return;
  const sheets = await getSheetsClient();
  return sheets.spreadsheets.values.batchClear({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { ranges },
  });
}

