
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

This app is optimized for **Cloudflare Pages**.

### Steps:
1.  Connect your GitHub repository to Cloudflare Pages.
2.  Set the **Build command** to `npm run build`.
3.  Set the **Output directory** to `dist`.
4.  Configure **Environment Variables** in the Cloudflare Dashboard:
    - `API_KEY`: Your Gemini API Key.
    - `SUPABASE_URL`: Your Supabase Project URL.
    - `SUPABASE_ANON_KEY`: Your Supabase Anon Key.
    - `SUPABASE_SERVICE_ROLE_KEY`: (For Webhooks) Your Supabase Service Role Key.
    - `STRIPE_SECRET_KEY`: Your Stripe Secret Key.
    - `STRIPE_WEBHOOK_SECRET`: Your Stripe Webhook Signing Secret.
    - `STRIPE_PRICE_ID_BASIC`: The Stripe Price ID for the Basic plan.
    - `STRIPE_PRICE_ID_PRO`: The Stripe Price ID for the Pro plan.
    - `STRIPE_PRICE_ID_BUSINESS`: The Stripe Price ID for the Business plan.
    - `SITE_URL`: Your deployed URL (e.g., `https://your-app.pages.dev`).

### Functions:
API routes are automatically handled by the files in the `/functions` directory. No extra configuration is needed for routing.
