# Harlem Night Market: vendor registration

A vendor application form plus an admin page that downloads every application
as an Excel (.xlsx) or CSV file. The .xlsx opens in Excel and imports straight
into Google Sheets.

Built with Next.js (App Router), TypeScript, Tailwind CSS, React Hook Form and
Zod, so it can grow into the full vendor and market-planning system.

## Pages

| Page | What it is |
| --- | --- |
| `/events/harlem-night-market` | Event page with market dates and an Apply button (`/` redirects here) |
| `/events/harlem-night-market/apply` | Vendor application form |
| `/application/thank-you` | Confirmation shown after submitting |
| `/admin` | Password-protected list of applications with Download Excel / Download CSV |

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then set ADMIN_PASSWORD
npm run dev                  # http://localhost:3000
```

Open `/admin` and sign in with any username and the `ADMIN_PASSWORD`.

## Changing event details and dates

Edit `lib/events.ts`: dates, market hours, venue, tagline and partner names.

The look (navy background, orange/pink/teal date tiles, Anton and Montserrat
type) follows the "Call for Vendors" flyer. The event and partner logos are in
`public/logos/`; the NYC EDC logo was recolored to white lettering on a
transparent background so it reads on navy. Colors live at the top
of `app/globals.css`.

## Where submissions are stored

For now, applications are saved to `data/applications.json` and uploaded
files to `data/uploads/<application id>/`. That works on a single server or
your own computer, but most hosts (Vercel, Netlify) don't keep files between
requests, so before going live the storage in `lib/store.ts` should move to
Supabase (database + file storage). Only that file needs to change.

## Getting the spreadsheet into Google Sheets

Download the Excel file from `/admin`, then in Google Drive choose
**New → File upload**, and open the file with Google Sheets. The workbook has
two tabs: **Applications** (one row per vendor) and **Menu Items** (one row
per food item).

## Files

- `components/VendorApplicationForm.tsx`: the form (with `FoodVendorFields`, `MenuItemRepeater`, `FileUploadField`)
- `lib/schema.ts`: field options and validation rules, shared by the form and the server
- `app/api/applications/route.ts`: receives submissions and checks them again on the server
- `lib/export.ts`: builds the Excel and CSV files
- `proxy.ts`: admin password check
