# InvoiceIntel

Smart Travel Claim, Bookkeeping or Expense Tracking for Professionals and Individuals. Uses Google Gemini AI to extract data from invoices and receipts.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Environment Variables:**
    Create a `.env` file for local development:
    ```env
    API_KEY=your_gemini_api_key
    SUPABASE_URL=your_supabase_url
    SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

3.  **Run Locally:**
    ```bash
    npm run dev
    ```

## Cloudflare Deployment

This project uses **Workers Assets** to deploy the Vite frontend and backend functions.

### Deployment Command:
1. **Build the app**: `npm run build`
2. **Deploy**: `npx wrangler deploy`

This will deploy your app to `https://invoiceintel.<your-subdomain>.workers.dev`.

### Environment Variables:
Ensure these are set in the Cloudflare Dashboard (Workers & Pages > invoiceintel > Settings > Variables):
- `API_KEY`: Your Gemini API Key.
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_ANON_KEY`: Your Supabase Anon Key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key.
- `STRIPE_SECRET_KEY`: Your Stripe Secret Key.
- `STRIPE_WEBHOOK_SECRET`: Your Stripe Webhook Signing Secret.
- `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_BUSINESS`: Your Stripe Price IDs.
- `SITE_URL`: Your deployed URL (e.g., `https://invoiceintel.isharukmani.workers.dev`).

### Troubleshooting
If you see a "Workers-specific command" error, ensure your `wrangler.jsonc` uses the `assets` key as shown in the project root.