# MSMAS entry app

A simple entry form (Sale / Expense / Transfer) that writes directly into
your MSMAS Google Sheet's `transaction` and `line` tabs.

## What you need before deploying

- Your service-account JSON key file (downloaded from Google Cloud)
- Your Google Sheet ID (from the Sheet's URL)
- A free GitHub account
- A free Vercel account

## 1. Push this code to GitHub

From this folder:

```
git init
git add .
git commit -m "MSMAS entry app"
```

Then create a new empty repository on github.com (no README/license —
just an empty repo), and follow the "push an existing repository" commands
it shows you, something like:

```
git remote add origin https://github.com/YOUR_USERNAME/msmas-app.git
git branch -M main
git push -u origin main
```

## 2. Deploy on Vercel

1. Go to vercel.com, sign in, click **Add New → Project**.
2. Import the `msmas-app` repository you just pushed.
3. Before clicking Deploy, open **Environment Variables** and add two:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — open your downloaded JSON key file,
     copy its entire contents, and paste it in as one value.
   - `GOOGLE_SHEET_ID` — the ID from your Sheet's URL.
4. Click **Deploy**. Vercel gives you a live URL when it finishes
   (usually under a minute).

## 3. Test it

Open the URL, submit a test entry, then check your Google Sheet's
`transaction` and `line` tabs — the new rows should appear, and the
`balance_check` tab should show `OK` for the new txn_id.

## One thing to fix in the Sheet before going live

The `line` tab has the `account_name` formula pre-filled all the way down
to row 500 so it's ready as you type manually. Because of that, the app's
automatic row-append may land further down than expected the first time
you use it. Quick fix: select the account_name formula cells below your
last real row of data and delete them — the app writes account names as
plain text itself, so the formula isn't needed for rows it creates.

## Notes

- Every submission is saved with `status = posted` immediately. If you
  want a draft/approval step later, that's a small addition to
  `app/api/submit/route.js`.
- Dropdown options for stores/customers are pulled live from the Sheet
  each time the form loads, so adding a new store or customer in the
  Sheet shows up in the form automatically — no redeploy needed.
- Expense categories and cash/bank accounts are currently listed in
  `lib/schema.js` and `app/components/EntryForm.js` — edit both if you
  add a new account to the `coa` tab.
