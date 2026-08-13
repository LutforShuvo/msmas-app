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

// Reads a tab's rows (used for dropdown lookups).
export async function readRows(range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || [];
}
