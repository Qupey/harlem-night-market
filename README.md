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

With `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set, applications go to Supabase:
the database tables `vendor_applications`, `vendor_date_preferences`,
`food_vendor_details`, `menu_items` and `uploaded_documents`, and uploaded files
go to the private `vendor-documents` storage bucket. Without them (handy on a
laptop) everything is saved to `data/` instead.

### One-time Supabase setup

1. In Supabase, open **SQL Editor**, click **New query**, paste the whole of
   `supabase/schema.sql`, and click **Run**. It's safe to run again.
2. From **Project Settings > API**, copy the Project URL and the **secret**
   key (`service_role`) into your hosting settings as `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY`. Never commit or share the secret key.

Row Level Security is on for every table with no public policies, so only
the website's server can read or write applications.

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
- `lib/store.ts`: picks Supabase (`lib/store-supabase.ts`) or local files (`lib/store-local.ts`)
- `supabase/schema.sql`: database tables, the save function, and the storage bucket
- `proxy.ts`: admin password check
