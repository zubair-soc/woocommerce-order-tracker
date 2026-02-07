# WooCommerce Order Tracker 🏒

A Next.js application to sync and manage WooCommerce orders for Shinny of Champions.

## Features

- 🔄 Sync orders from WooCommerce to Supabase database
- 📊 View all orders in a clean dashboard
- 🔍 Filter by customer name, email, status, date range
- 💳 Track payment methods and order status
- 📦 View product details for each order

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Supabase** - PostgreSQL database
- **WooCommerce REST API** - Order syncing

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Enter project details:
   - **Name**: `woocommerce-order-tracker` (or your choice)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to Edmonton
4. Click "Create new project" (takes ~2 minutes)

### 2. Create Database Table

Once your project is created, go to the SQL Editor and run this:

```sql
-- Create orders table
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER UNIQUE NOT NULL,
  order_number TEXT NOT NULL,
  date_created TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postcode TEXT,
  billing_country TEXT,
  total TEXT NOT NULL,
  payment_method TEXT,
  payment_method_title TEXT,
  products JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_orders_date_created ON orders(date_created DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
```

### 3. Get Supabase Credentials

In your Supabase project dashboard:

1. Click **Settings** (gear icon)
2. Go to **API** section
3. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (the long string under "Project API keys")

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# WooCommerce API Credentials
NEXT_PUBLIC_WC_URL=https://shinnyofchampions.com
WC_CONSUMER_KEY=ck_2e7e6a7f5d6efbf742445366a1da93453c53fc74
WC_CONSUMER_SECRET=cs_81b9d5126cfa708443815d8bf309498735699243

# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Replace the Supabase values with your actual credentials from Step 3.

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 7. Sync Your First Orders

1. Click the "🔄 Sync Orders from WooCommerce" button
2. Wait for the sync to complete
3. Your orders will appear in the table!

## Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository (or upload the folder)
4. Add environment variables:
   - `NEXT_PUBLIC_WC_URL`
   - `WC_CONSUMER_KEY`
   - `WC_CONSUMER_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts and add your environment variables when asked.

## Usage

### Syncing Orders

- Click "Sync Orders" button to fetch latest orders from WooCommerce
- Orders are automatically upserted (won't create duplicates)
- Sync runs the most recent 100 orders (can be adjusted in code)

### Filtering Orders

- **Search**: Filter by customer name, email, or order number
- **Status**: Filter by order status (completed, processing, pending, etc.)
- **Date Range**: Filter orders between specific dates
- **Clear Filters**: Reset all filters at once

### Automatic Updates

Currently, you need to manually click "Sync Orders" to update. Future enhancements could include:
- Automatic syncing on a schedule
- Real-time webhooks from WooCommerce
- Email notifications for new orders

## Database Schema

The `orders` table includes:
- Order details (ID, number, date, status)
- Customer information (name, email, phone)
- Billing address
- Payment method
- Products (stored as JSON)
- Timestamps

## Security Notes

- API keys are stored in environment variables (never committed to git)
- WooCommerce API uses read-only permissions
- Supabase anon key only allows operations defined in Row Level Security policies

## Troubleshooting

### "Failed to sync orders"
- Check your WooCommerce API credentials
- Verify your store URL is correct
- Ensure WooCommerce REST API is enabled

### "Error fetching orders"
- Check your Supabase credentials
- Verify the `orders` table exists
- Check Supabase dashboard for error logs

### Orders not appearing
- Click "Sync Orders" first
- Check browser console for errors
- Verify you have orders in WooCommerce

## Future Enhancements

- [ ] Authentication (login system)
- [ ] Order details modal/page
- [ ] Export to CSV/Excel
- [ ] Automatic scheduled syncing
- [ ] Email notifications
- [ ] Product/program filtering
- [ ] Customer analytics
- [ ] Integration with registration workflow

## Support

For issues or questions, contact YG or check the Supabase/Vercel documentation.
