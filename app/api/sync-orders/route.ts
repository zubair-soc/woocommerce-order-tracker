import { NextResponse } from 'next/server'
import { wooApi, WooCommerceOrder } from '@/lib/woocommerce'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch all orders with pagination
    let allOrders: WooCommerceOrder[] = []
    let page = 1
    let hasMorePages = true
    const perPage = 100

    while (hasMorePages) {
      const response = await wooApi.get('orders', {
        per_page: perPage,
        page: page,
        orderby: 'date',
        order: 'desc',
      })

      const orders: WooCommerceOrder[] = response.data
      allOrders = [...allOrders, ...orders]

      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1')
      hasMorePages = page < totalPages
      page++
    }

    // Fetch all products (published, draft, all statuses)
    let allProducts: any[] = []
    page = 1
    hasMorePages = true

    while (hasMorePages) {
      const response = await wooApi.get('products', {
        per_page: 100,
        page: page,
        status: 'any', // Get all statuses (publish, draft, private, etc)
      })

      const products = response.data
      allProducts = [...allProducts, ...products]

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
      // Phone and address NOT synced - kept in WooCommerce only
      customer_phone: '',
      billing_address: '',
      billing_city: '',
      billing_state: '',
      billing_postcode: '',
      billing_country: '',
      total: order.total,
      payment_method: order.payment_method,
      payment_method_title: order.payment_method_title,
      products: order.line_items,
      // Defaults for new orders (won't overwrite existing values on update)
      payment_status: 'paid',
      has_installments: false,
    }))

    // Transform and insert products
    const productsToInsert = allProducts.map((product) => ({
      product_id: product.id,
      name: product.name,
      status: product.status,
    }))

    // Upsert orders
    const { error: ordersError } = await supabase
      .from('orders')
      .upsert(ordersToInsert, { onConflict: 'order_id' })

    if (ordersError) {
      console.error('Supabase orders error:', ordersError)
      return NextResponse.json(
        { error: 'Failed to sync orders', details: ordersError },
        { status: 500 }
      )
    }

    // Upsert products
    const { error: productsError } = await supabase
      .from('products')
      .upsert(productsToInsert, { onConflict: 'product_id' })

    if (productsError) {
      console.error('Supabase products error:', productsError)
      return NextResponse.json(
        { error: 'Failed to sync products', details: productsError },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: `Synced ${allOrders.length} orders and ${allProducts.length} products`,
        orderCount: allOrders.length,
        productCount: allProducts.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync', details: error.message },
      { status: 500 }
    )
  }
}
