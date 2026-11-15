# Vetted.bb test checklist

Everything built since 12 November that needs a person to try it. When a section passes, tell Claude and it moves those items to SHIPPED in `CHANGELOG.md`.

**Tick items on the checklist page, not here:** https://claude.ai/artifact/UwDDgE8KF7LfWiEGz4s9dA (private to you; works on your phone). The boxes below don't click in a file viewer. Claude keeps the two in step: when this file changes, the page is republished; ticks are read from the page.

**You will need four browsers or windows** (a private window counts as one):

| Who | What it is |
|---|---|
| **Visitor** | signed out |
| **Pro** | your professional account |
| **Client** | a second account, signed up as a client |
| **Org** | a third account, signed up as an organisation (none exist yet) |

Localhost uses the live database, so anything you send while testing is real.

---

## 0. Before you start

- [ ] SQL Section 44 (deposits and part payments) has been run in Supabase
- [ ] The latest code is pushed and live (ask Claude to confirm the deploy)
- [ ] SQL Section 45 (payment reminders) has been run
- [ ] SQL Section 46 (rate limits) has been run
- [ ] SQL Section 47 (expenses) has been run (after 44)

---

## 1. Visitor (signed out)

- [ ] Homepage, Search, a category page and a profile all load
- [ ] On a profile, every **Contact** / **Request a Quote** / **Message** button goes to the log-in page
- [ ] No professional's email address or phone number appears anywhere on a profile
- [ ] `/badges` lists **five** marks, including Rising Talent
- [ ] There is no **Admin** link anywhere

## 2. Client account

**Enquiries and messages**
- [ ] Send an enquiry from a profile. The name and email boxes show your account's name and address and cannot be edited (the name is changed on your dashboard)
- [ ] The Pro gets an email, a push and a bell notification for it
- [ ] Reply in that conversation. The Pro is notified again
- [ ] The conversation header shows the Pro's email address under their name, on a phone too

**Quotes, deposits and invoices**
- [ ] A quote with a deposit shows "Deposit … upfront" on its card, and **View & download** shows "Deposit required" and "Balance on completion" under Total
- [ ] Accept it. A **Deposit invoice** arrives for the deposit amount only (not the full total); its **View & download** says DEPOSIT INVOICE, with "Deposit due" in bold
- [ ] The deposit invoice PDF is titled DEPOSIT INVOICE and shows "Deposit due (50%)"
- [ ] After the Pro records part of a payment, the card shows "Still to pay" and My jobs shows "Paid … left"
- [ ] The balance invoice, once raised, arrives as **Balance invoice**; its **View & download** says BALANCE INVOICE with the balance invoice's own number and due date, "Deposit paid" and "Balance due", and the buttons say "Balance invoice PDF" and "Original quote PDF"
- [ ] A receipt PDF only downloads once the job is fully paid
- [ ] A quote with **no** deposit is invoiced for the full total, exactly as before

**Other**
- [ ] Save a professional, remove them, save again. The Pro gets **one** notification, not two
- [ ] Booking request: a date in the past is refused; a normal future date goes through
- [ ] After a job is completed and paid, leave a review **with a photo**. The photo shows on the profile
- [ ] There is no **Admin** link

## 3. Pro account (your own)

**Profile and photos**
- [ ] Dashboard, Inbox, Quotes & earnings, Calendar and Settings all load
- [ ] Inbox: open a conversation that has a quote or invoice card in it. It opens (it used to show "This page couldn't load")
- [ ] Edit profile shows your payment details and default terms; change your bio, save, refresh, and it stayed
- [ ] Change your profile photo, then remove it
- [ ] Add a portfolio image, then delete it
- [ ] Add a service photo
- [ ] Attach a photo in a chat reply
- [ ] Phone verification: verify a number and the badge appears on your public profile

**Quotes and invoices**
- [ ] Quote builder: tick **Require a deposit**, try Percentage and Fixed amount; the deposit updates as you change line items
- [ ] **Preview** the quote. The PDF shows "Deposit required (50%)" in navy bold and "Balance on completion" under Total
- [ ] **Send invoice** on an accepted deposit quote. The dialog says "Send the deposit invoice?" and shows the deposit amount
- [ ] On the invoice in Quotes & earnings, the **Payments** panel shows Unpaid
- [ ] **Record a payment** for part of it. The panel shows Part-paid with the amount left, and the history lists the payment
- [ ] **Remove** that payment. It goes back to Unpaid, and the payment stays listed under **Removed**, struck through, with the day it was removed
- [ ] Try to record more than is owed: "That is more than is still owed on this job" and nothing is saved
- [ ] Record the full deposit. **Raise balance invoice** appears; click it and the client gets the balance invoice
- [ ] Record the rest. The job shows Paid, appears in earnings, and the Receipt PDF button appears
- [ ] An invoice PDF that is part-paid shows Total / Paid / **Balance due**
- [ ] A job you ticked paid before this change still shows as paid, with Undo
- [ ] Your client receives the notification for: a reply, a quote, an invoice, a payment reminder and a receipt
- [ ] Confirm a rental booking. The quote is sent automatically

**Expenses (only you should ever see these)**
- [ ] On a job in Quotes & earnings, **+ Add expense**: description, amount, date, a receipt photo; it appears in the list and the Invoiced / Expenses / Profit summary updates
- [ ] Open the receipt from the list. Copy its address into a private window: it no longer opens after five minutes
- [ ] Add one expense with **Bill to client** and one without. The profit only goes down by the unbilled one, and the first figure reads "Quoted + to bill"
- [ ] On a quote the client has not accepted yet, the expenses section says the billed cost goes on the invoice once they accept
- [ ] Once the client accepts, **Send invoice**: the PDF shows the billed one as "Cost: …" and its total includes it; the unbilled one is nowhere on it
- [ ] As the Client: the invoice card, the preview, the PDF and the email show the billed cost only; the unbilled one appears nowhere, and there is no Expenses section or profit figure anywhere
- [ ] The **quote** PDF never shows costs
- [ ] On a deposit job, a billed expense goes on the **balance** invoice, not the deposit invoice
- [ ] After the invoice is sent, a new expense cannot be ticked "Bill to client" (it says it stays internal)
- [ ] Export CSV with **Also download my expenses**: after the first file, a **Download second file** button gives the expenses file, with each expense and the job's invoiced, expenses and profit

**Outstanding card**
- [ ] The dashboard shows **OUTSTANDING** near the top: the amount still owed (a part-paid invoice counts only what is left), "across N invoices", and "N overdue" in red when any are overdue
- [ ] With nothing owed it shows Bds$0.00 and "All invoices paid"
- [ ] Clicking the card opens Quotes & earnings on **Pending payment**

**Reports (year-end summary)**
- [ ] **Reports** is in your sidebar under Quotes & earnings and opens on this year
- [ ] The headline reads "Total received in 2026 (cash basis)"; the figure matches the payments you recorded this year
- [ ] An invoice issued last December and paid this January counts as invoiced last year and received this year (switch the year to check)
- [ ] Expenses logged and Net match your expenses; Clients counts each client once
- [ ] The month table adds up to the figures above
- [ ] **Download as PDF**: the Vetted.bb-branded summary, same figures as the screen, the disclaimer at the bottom, no expense descriptions
- [ ] **Download as CSV**: one row per month, opens in Excel
- [ ] A year with nothing in it shows zeros, not an error

**Export**
- [ ] Quotes & earnings, **Export CSV**: the file opens in Excel with the columns in order, deposit and balance invoices as separate lines, and payment method filled in where you recorded one
- [ ] "Last year" says "No records found for that date range" and downloads nothing

**Admin**
- [ ] The **Admin** link is in your sidebar
- [ ] Admin → Freelancers → **↑ Rising** on a profile: the badge appears on search, a category page and that profile's header
- [ ] Click **↑ Rising** again to remove it

**Account**
- [ ] Settings → **Send a test notification** (shown when push is on). It says it was sent to your devices and one arrives; if it names a missing key, add it in Vercel and redeploy
- [ ] **Log out** from the sidebar signs this device out only

## 4. Organisation account

- [ ] Sign up as an organisation. The organisation is created
- [ ] Team: invite a colleague. Invite the same address again: no second email, and the existing link is shown
- [ ] New quote request to two or three professionals. Each one is notified
- [ ] On the request page, a quote with a deposit shows the deposit and the balance
- [ ] Accept a quote. The invoice arrives
- [ ] A colleague in the organisation can read the replies in the organisation's conversation
- [ ] Records → **Export CSV**: Professional name and email, Raised by, and PO number are filled in
- [ ] Records → **Year-end summary** (button at the top, section at the bottom): "Total paid (cash basis)", Professionals instead of Clients, no Expenses or Net; the PDF says "Spending summary" and has the organisation's name
- [ ] Records shows **PAYABLE** at the top: what the organisation still owes, with "N overdue" in red when any are; clicking it filters the table to **Unpaid invoices**

## 5. Payment reminders

The daily job runs at 9am Barbados time. It is in **dry-run** mode (logs only, sends nothing) until `PAYMENT_REMINDERS_MODE` is set to `live` in Vercel.

- [ ] After the first morning run (9am Barbados time, so from Sunday 15 November), in Supabase run: `SELECT sent_on, invoice_number, stage, amount, dry_run, recipients FROM payment_reminder_log ORDER BY created_at DESC LIMIT 20;` and check each row is an invoice that really should be reminded
- [ ] Only then add `PAYMENT_REMINDERS_MODE` = `live` in Vercel (Settings → Environment Variables → **Add**; it is not there until you add it) and redeploy
- [ ] Settings → **Payment reminders** is on by default, and can be switched off
- [ ] An invoice has **Pause reminders**, and a paused invoice gets nothing
- [ ] Live: a client gets a reminder 3 days before, on the due date, then at 7, 14 and 30 days overdue, and never twice in one day
- [ ] A part-paid invoice's reminder states the **outstanding** amount, not the total
- [ ] You (the Pro) get a notification at 7, 14 and 30 days overdue only
- [ ] An invoice sent less than 24 hours ago gets no reminder, even if it is due
- [ ] In the dry-run log, **no** invoice is more than 13 days overdue unless it already had a reminder, and none is 60 or more days overdue (old unpaid invoices are left alone)
- [ ] Every address in `recipients` is someone from that job's conversation (the client who enquired, or the organisation's members)
- [ ] Live: `SELECT sent_on, invoice_number, stage, error FROM payment_reminder_log WHERE NOT dry_run ORDER BY created_at DESC LIMIT 20;` shows an empty `error` for each one that went

## 6. Rate limits

- [ ] After SQL Section 48: as the Client, send an enquiry six times quickly (new or in the same conversation). The sixth is refused with "Too many enquiries: you can send 5 every 10 minutes", even across page reloads
- [ ] Ordinary chat replies are not limited like that: send ten quick replies in a conversation and all go
- [ ] While the Client is limited, the Pro account on the **same wifi** can still send an enquiry (the limit is per person, not per connection)
- [ ] In Supabase, `SELECT key, window_start, hits FROM rate_limits ORDER BY window_start DESC LIMIT 10;` shows hashed keys (no IP addresses)

## 7. Settings already done

- [x] Supabase minimum password (8 characters, mixed case, digits and symbols). Set 13 November
- [x] Legacy API keys changed. Confirmed 13 November
