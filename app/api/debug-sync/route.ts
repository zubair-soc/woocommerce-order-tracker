import { NextResponse } from 'next/server'
import { wooApi } from '@/lib/woocommerce'
import { supabase } from '@/lib/supabase'

// Force dynamic rendering - never cache this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Fetch latest 5 orders from WooCommerce
    // Exclude same statuses as frontend: checkout-draft, pending, failed, cancelled
    const wooResponse = await wooApi.get('orders', {
      per_page: 5,
      orderby: 'date',
      order: 'desc',
      status: 'processing,completed,on-hold,refunded', // Only include visible statuses
    })
    const wooOrders = wooResponse.data

    // Fetch latest 5 orders from Supabase
    // Match the frontend filter - exclude drafts, pending, failed, cancelled
    const { data: supabaseOrders, error } = await supabase
      .from('orders')
      .select('*')
      .not('status', 'in', '("checkout-draft","pending","failed","cancelled")')
      .order('date_created', { ascending: false })
      .limit(5)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Compare the two
    const wooOrderIds = wooOrders.map((o: any) => o.id)
    const supabaseOrderIds = supabaseOrders?.map(o => o.order_id) || []
    
    const missingInSupabase = wooOrderIds.filter((id: number) => !supabaseOrderIds.includes(id))

    return NextResponse.json({
      wooCommerce: {
        count: wooOrders.length,
        latestOrderId: wooOrders[0]?.id,
        latestOrderNumber: wooOrders[0]?.number,
        latestOrderDate: wooOrders[0]?.date_created,
        latestOrderStatus: wooOrders[0]?.status,
        orderIds: wooOrderIds,
      },
      supabase: {
        count: supabaseOrders?.length || 0,
        latestOrderId: supabaseOrders?.[0]?.order_id,
        latestOrderNumber: supabaseOrders?.[0]?.order_number,
        latestOrderDate: supabaseOrders?.[0]?.date_created,
        orderIds: supabaseOrderIds,
      },
      comparison: {
        missingInSupabase,
        allInSync: missingInSupabase.length === 0,
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
