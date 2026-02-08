import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('program_colors')
    .select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ colors: data })
}

export async function POST(request: Request) {
  const { program_name, color } = await request.json()

  const { data, error } = await supabase
    .from('program_colors')
    .upsert({ program_name, color }, { onConflict: 'program_name' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, color: data })
}
