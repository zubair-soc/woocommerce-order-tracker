-- WooCommerce Order Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_date_created ON orders(date_created DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Optional: Create a function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update 'updated_at'
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Enable Row Level Security (RLS) for future authentication
-- Uncomment these when you add authentication
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for now, since no auth)
-- Uncomment and modify when adding authentication
-- CREATE POLICY "Allow all operations" ON orders FOR ALL USING (true);
