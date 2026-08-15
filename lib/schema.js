// These IDs match the coa tab in MSMAS_base.xlsx exactly.
// If you rename or add accounts in the sheet, update this file to match.

export const CASH_BANK_ACCOUNTS = [
  { id: "1000", name: "Cash" },
  { id: "1001", name: "Hasan account" },
  { id: "1002", name: "Rafi account" },
];

export const AR_ACCOUNT = { id: "1003", name: "Accounts Receivable" };
export const AP_ACCOUNT = { id: "2000", name: "Accounts Payable" };
export const SALES_REVENUE = { id: "4000", name: "Sales Revenue" };

export const PURCHASE_CATEGORIES = [
  { id: "5001", name: "Purchase Expense" },
  { id: "5003", name: "Purchase Return" },
];

export const EXPENSE_CATEGORIES = [
  { id: "6000", name: "Salaries & Wages" },
  { id: "6001", name: "Rent Expense" },
  { id: "6002", name: "Utilities Expense" },
  { id: "6003", name: "Advertising & Marketing" },
  { id: "6004", name: "Delivery Expense" },
  { id: "6005", name: "Office Expense" },
  { id: "6006", name: "Internet & Telephone" },
  { id: "6007", name: "Software & Subscriptions" },
  { id: "6008", name: "Repairs & Maintenance" },
  { id: "6009", name: "Travel & Transportation" },
  { id: "6010", name: "Bank Charges" },
  { id: "5001", name: "Purchase Expense" },
  { id: "5002", name: "Delivery / Freight In" },
];

export const HEAD_OFFICE_STORE_ID = "S00";

export const TXN_TYPE_LABEL = {
  sale: "Sale",
  expense: "Expense",
  transfer: "Bank Transfer",
  purchase: "Purchase",
  payment: "Payment",
};

function accountName(list, id) {
  return (list.find((a) => a.id === id) || {}).name || id;
}
export function resolveAccountName(id) {
  return (
    accountName(CASH_BANK_ACCOUNTS, id) !== id
      ? accountName(CASH_BANK_ACCOUNTS, id)
      : accountName(EXPENSE_CATEGORIES, id) !== id
      ? accountName(EXPENSE_CATEGORIES, id)
      : id === AR_ACCOUNT.id
      ? AR_ACCOUNT.name
      : id === AP_ACCOUNT.id
      ? AP_ACCOUNT.name
      : id === SALES_REVENUE.id
      ? SALES_REVENUE.name
      : id
  );
}
