import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Force dynamic rendering - settings can change frequently
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { data, error } = await supabase
    .from('program_settings')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}

export async function POST(request: Request) {
  const { program_name, status, display_order, start_date, notes } = await request.json()

  // Build update object with only provided fields
  const updateData: any = { program_name }
  if (status !== undefined) updateData.status = status
  if (display_order !== undefined) updateData.display_order = display_order
  if (start_date !== undefined) updateData.start_date = start_date
  if (notes !== undefined) updateData.notes = notes

  const { data, error } = await supabase
    .from('program_settings')
    .upsert(updateData, { onConflict: 'program_name' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, setting: data })
}
