import { NextResponse } from 'next/server'
import { wooApi, WooCommerceOrder } from '@/lib/woocommerce'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    let allOrders: WooCommerceOrder[] = []
    let page = 1
    let hasMorePages = true
    const perPage = 100

    // Fetch all pages of orders from WooCommerce
    while (hasMorePages) {
      const response = await wooApi.get('orders', {
        per_page: perPage,
        page: page,
        orderby: 'date',
        order: 'desc',
      })

      const orders: WooCommerceOrder[] = response.data
      allOrders = [...allOrders, ...orders]

      // Check if there are more pages
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1')
      hasMorePages = page < totalPages
      page++
    }

    // Transform and insert orders into Supabase
    const ordersToInsert = allOrders.map((order) => ({
      order_id: order.id,
      order_number: order.number,
      date_created: order.date_created,
      status: order.status,
      customer_first_name: order.billing.first_name,
      customer_last_name: order.billing.last_name,
      customer_email: order.billing.email,
      customer_phone: order.billing.phone || '',
      billing_address: `${order.billing.address_1} ${order.billing.address_2}`.trim(),
      billing_city: order.billing.city,
      billing_state: order.billing.state,
      billing_postcode: order.billing.postcode,
      billing_country: order.billing.country,
      total: order.total,
      payment_method: order.payment_method,
      payment_method_title: order.payment_method_title,
      products: order.line_items,
    }))

    // Upsert orders (insert or update if exists)
    const { data, error } = await supabase
      .from('orders')
      .upsert(ordersToInsert, { onConflict: 'order_id' })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to sync orders', details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${allOrders.length} orders from ${page - 1} page(s)`,
      count: allOrders.length,
      pages: page - 1,
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync orders', details: error.message },
      { status: 500 }
    )
  }
}
