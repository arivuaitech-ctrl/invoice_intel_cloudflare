# InvoiceIntel - AI Expense Tracker

Smart expense tracking for professionals. Uses Google Gemini AI to extract data from invoices and receipts.

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

## Cloudflare Pages Deployment

### Recommended Dashboard Settings:
1.  **Build command**: `npm run build`
2.  **Build output directory**: `dist`
3.  **Deployment command (Optional)**: If you manually set a deploy command, use `npx wrangler deploy`. However, Cloudflare Pages usually deploys automatically from the `dist` folder if the "Build output directory" is set correctly.

### Environment Variables:
Ensure these are set in the Cloudflare Pages Dashboard (Settings > Functions > Variables):
- `API_KEY`: Your Gemini API Key.
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_ANON_KEY`: Your Supabase Anon Key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key.
- `STRIPE_SECRET_KEY`: Your Stripe Secret Key.
- `STRIPE_WEBHOOK_SECRET`: Your Stripe Webhook Signing Secret.
- `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_BUSINESS`: Your Stripe Price IDs.
- `SITE_URL`: Your deployed URL (e.g., `https://your-app.pages.dev`).

### Troubleshooting
If the build fails with "Missing entry-point", verify that the `wrangler.jsonc` file is in the root directory and contains the correct `assets.directory` path.