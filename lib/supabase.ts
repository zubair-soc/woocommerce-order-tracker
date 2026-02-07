import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Order {
  id: number
  order_id: number
  order_number: string
  date_created: string
  status: string
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_phone: string
  billing_address: string
  billing_city: string
  billing_state: string
  billing_postcode: string
  billing_country: string
  total: string
  payment_method: string
  payment_method_title: string
  products: any // JSON
  created_at: string
  updated_at: string
}
