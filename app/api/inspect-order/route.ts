import { NextRequest, NextResponse } from 'next/server'
import { wooApi } from '@/lib/woocommerce'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const orderId = searchParams.get('id')

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
  }

  try {
    const response = await wooApi.get(`orders/${orderId}`)
    const order = response.data

    return NextResponse.json({
      order_number: order.number,
      date_created: order.date_created,
      status: order.status,
      customer: {
        first_name: order.billing.first_name,
        last_name: order.billing.last_name,
        email: order.billing.email,
        phone: order.billing.phone || '(not provided)',
      },
      billing_address: {
        address_1: order.billing.address_1 || '(not provided)',
        address_2: order.billing.address_2 || '(not provided)',
        city: order.billing.city || '(not provided)',
        state: order.billing.state || '(not provided)',
        postcode: order.billing.postcode || '(not provided)',
        country: order.billing.country || '(not provided)',
      },
      shipping_address: {
        address_1: order.shipping.address_1 || '(not provided)',
        address_2: order.shipping.address_2 || '(not provided)',
        city: order.shipping.city || '(not provided)',
        state: order.shipping.state || '(not provided)',
        postcode: order.shipping.postcode || '(not provided)',
        country: order.shipping.country || '(not provided)',
      },
      products: order.line_items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        total: item.total,
      })),
      payment: {
        method: order.payment_method_title,
        total: order.total,
      },
      full_data: order, // Complete raw data
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch order', details: error.message },
      { status: 500 }
    )
  }
}
