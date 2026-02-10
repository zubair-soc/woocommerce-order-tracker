import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch all templates
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ templates: data || [] })
  } catch (error: any) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create or update template
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, name, description, template_html } = body

    if (!name || !template_html) {
      return NextResponse.json(
        { error: 'Name and template_html are required' },
        { status: 400 }
      )
    }

    if (id) {
      // Update existing template
      const { data, error } = await supabase
        .from('email_templates')
        .update({ name, description, template_html })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, template: data })
    } else {
      // Create new template
      const { data, error } = await supabase
        .from('email_templates')
        .insert({ name, description, template_html })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, template: data })
    }
  } catch (error: any) {
    console.error('Error saving template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove template
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
