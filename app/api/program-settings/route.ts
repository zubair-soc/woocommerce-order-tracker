import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('program_settings')
    .select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}

export async function POST(request: Request) {
  const { program_name, status } = await request.json()

  const { data, error } = await supabase
    .from('program_settings')
    .upsert({ program_name, status }, { onConflict: 'program_name' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, setting: data })
}
