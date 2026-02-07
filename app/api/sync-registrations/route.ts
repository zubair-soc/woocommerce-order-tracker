import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // Get all orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('date_created', { ascending: false })

    if (ordersError) throw ordersError

    // Normalize product name helper
    const normalizeProductName = (name: string): string => {
      return name
        .replace(/\s*-?\s*\d+\s*SPOTS?\s*LEFT/gi, '')
        .replace(/\s*-?\s*\d+%?\s*FULL/gi, '')
        .replace(/\s*-?\s*FULL\s*$/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Extract registrations from orders
    const registrationsToSync: any[] = []

    orders?.forEach(order => {
      if (!order.products || !Array.isArray(order.products)) return

      order.products.forEach((product: any) => {
        const programName = normalizeProductName(product.name || '')
        if (!programName) return

        registrationsToSync.push({
          program_name: programName,
          player_name: `${order.customer_first_name} ${order.customer_last_name}`.trim(),
          player_email: order.customer_email,
          player_phone: order.customer_phone,
          order_id: order.order_id,
          source: 'order',
          payment_method: 'woocommerce',
          amount: product.total || order.total,
          status: 'active',
          notes: `Order #${order.order_number}`,
        })
      })
    })

    // Check existing registrations to avoid duplicates
    const { data: existingRegs } = await supabase
      .from('program_registrations')
      .select('order_id, program_name')
      .not('order_id', 'is', null)

    const existingKeys = new Set(
      existingRegs?.map(r => `${r.order_id}-${r.program_name}`) || []
    )

    // Filter out duplicates
    const newRegistrations = registrationsToSync.filter(reg => 
      !existingKeys.has(`${reg.order_id}-${reg.program_name}`)
    )

    if (newRegistrations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new registrations to sync',
        synced: 0,
      })
    }

    // Insert new registrations
    const { error: insertError } = await supabase
      .from('program_registrations')
      .insert(newRegistrations)

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      message: `Synced ${newRegistrations.length} registrations`,
      synced: newRegistrations.length,
    })
  } catch (error: any) {
    console.error('Sync registrations error:', error)
    return NextResponse.json(
      { error: 'Failed to sync registrations', details: error.message },
      { status: 500 }
    )
  }
}
