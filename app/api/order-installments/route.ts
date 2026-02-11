import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch installments for an order
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')

    if (!orderId) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('order_installments')
      .select('*')
      .eq('order_id', orderId)
      .order('installment_number', { ascending: true })

    if (error) throw error

    return NextResponse.json({ installments: data || [] })
  } catch (error: any) {
    console.error('Error fetching installments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create or update installment
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      order_id,
      installment_number,
      amount_due,
      amount_paid,
      due_date,
      paid_date,
      status,
      notes
    } = body

    if (!order_id || !installment_number || !amount_due) {
      return NextResponse.json(
        { error: 'order_id, installment_number, and amount_due are required' },
        { status: 400 }
      )
    }

    if (id) {
      // Update existing installment
      const { data, error } = await supabase
        .from('order_installments')
        .update({
          installment_number,
          amount_due,
          amount_paid: amount_paid || '0',
          due_date,
          paid_date,
          status: status || 'pending',
          notes
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, installment: data })
    } else {
      // Create new installment
      const { data, error } = await supabase
        .from('order_installments')
        .insert({
          order_id,
          installment_number,
          amount_due,
          amount_paid: amount_paid || '0',
          due_date,
          paid_date,
          status: status || 'pending',
          notes
        })
        .select()
        .single()

      if (error) throw error
      
      // Update orders table flag
      await supabase
        .from('orders')
        .update({ has_installments: true })
        .eq('order_id', order_id)
      
      return NextResponse.json({ success: true, installment: data })
    }
  } catch (error: any) {
    console.error('Error saving installment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove installment
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Installment ID required' }, { status: 400 })
    }

    // First, get the order_id before deleting
    const { data: installment } = await supabase
      .from('order_installments')
      .select('order_id')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('order_installments')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Check if any installments remain for this order
    if (installment) {
      const { data: remaining } = await supabase
        .from('order_installments')
        .select('id')
        .eq('order_id', installment.order_id)
        .limit(1)

      // If no installments left, set flag to false
      if (!remaining || remaining.length === 0) {
        await supabase
          .from('orders')
          .update({ has_installments: false })
          .eq('order_id', installment.order_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting installment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
