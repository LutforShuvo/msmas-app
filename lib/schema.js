// A structural constant, not an account — the store row used for
// corporate-level entries that aren't tied to one brand. This one is safe
// to hardcode since it's set once during initial setup and store IDs
// aren't renumbered the way accounts sometimes are. Every account-related
// value, by contrast, is resolved live — see lib/accounts.js.
export const HEAD_OFFICE_STORE_ID = "S00";
