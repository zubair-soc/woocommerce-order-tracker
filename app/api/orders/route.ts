import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// PATCH - Update order payment status
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { order_id, payment_status } = body

    if (!order_id || !payment_status) {
      return NextResponse.json(
        { error: 'order_id and payment_status required' },
        { status: 400 }
      )
    }

    if (!['paid', 'unpaid'].includes(payment_status)) {
      return NextResponse.json(
        { error: 'payment_status must be "paid" or "unpaid"' },
        { status: 400 }
      )
    }

    // Step 1: Update the order
    const { error: orderError } = await supabase
      .from('orders')
      .update({ payment_status })
      .eq('order_id', order_id)

    if (orderError) throw orderError

    // Step 2: Cascade to all registrations from this order
    const { error: registrationError } = await supabase
      .from('program_registrations')
      .update({ payment_status })
      .eq('order_id', order_id)

    if (registrationError) throw registrationError

    return NextResponse.json({ 
      success: true,
      message: `Order and registrations marked as ${payment_status}`
    })
  } catch (error: any) {
    console.error('Error updating payment status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
