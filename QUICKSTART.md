# Quick Start Guide 🚀

Get your WooCommerce Order Tracker running in 10 minutes!

## Step 1: Create Supabase Project (2 minutes)

1. Go to https://supabase.com
2. Sign in or create account
3. Click "New Project"
4. Fill in:
   - **Name**: `woocommerce-order-tracker`
   - **Password**: (create strong password - save it!)
   - **Region**: North America (West)
5. Click "Create new project"
6. Wait ~2 minutes for setup

## Step 2: Create Database Table (1 minute)

1. In your new Supabase project, click **SQL Editor** (left sidebar)
2. Click "New query"
3. Copy and paste the contents of `supabase-schema.sql` file
4. Click "Run" or press Ctrl+Enter
5. You should see: "Success. No rows returned"

## Step 3: Get Supabase Credentials (1 minute)

1. Click **Settings** (gear icon, bottom left)
2. Click **API** in the settings menu
3. Copy these two values:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under "Project API keys")
4. Keep these handy for next step

## Step 4: Add Your Credentials (2 minutes)

1. Open the `.env.local` file in the project folder
2. Replace these lines with your actual values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
3. Your WooCommerce credentials are already filled in!
4. Save the file

## Step 5: Install & Run (3 minutes)

Open Terminal/Command Prompt in the project folder:

```bash
# Install dependencies
npm install

# Run the app
npm run dev
```

Open http://localhost:3000 in your browser!

## Step 6: Sync Your Orders! (1 minute)

1. Click the big blue "🔄 Sync Orders from WooCommerce" button
2. Wait a few seconds
3. See your orders appear!
4. Try the filters!

---

## Deploy to Vercel (Optional - 5 minutes)

### Quick Deploy:

1. Go to https://vercel.com
2. Click "New Project"
3. Import this project (upload folder or connect GitHub)
4. Add environment variables:
   - Click "Environment Variables"
   - Add all 5 variables from your `.env.local` file
5. Click "Deploy"
6. Done! Share your live URL

---

## Need Help?

### Common Issues:

**"Failed to sync orders"**
- Double-check your WooCommerce Consumer Key and Secret
- Make sure your store URL is exactly: `https://shinnyofchampions.com`

**"Error fetching orders"**
- Verify you ran the SQL schema in Supabase
- Check your Supabase URL and key are correct
- Make sure you copied the full key (it's very long!)

**Nothing happens when clicking Sync**
- Open browser console (F12) to see error messages
- Check all environment variables are filled in
- Try refreshing the page

### Still Stuck?

Check the full README.md for detailed troubleshooting!
