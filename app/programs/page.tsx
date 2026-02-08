'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'


interface ProgramSummary {
  name: string
  count: number
  activeCount: number
  color?: string
  category: string
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [programFilter, setProgramFilter] = useState<'active' | 'all'>('active')
  const [coloringProgram, setColoringProgram] = useState<string | null>(null)
  const [programColors, setProgramColors] = useState<{[key: string]: string}>({})

  // Fetch colors once on mount
  useEffect(() => {
    const fetchColors = async () => {
      const colorsResponse = await fetch('/api/program-colors')
      const colorsData = await colorsResponse.json()
      if (colorsData.colors) {
        const colorMap: {[key: string]: string} = {}
        colorsData.colors.forEach((c: any) => {
          colorMap[c.program_name] = c.color
        })
        setProgramColors(colorMap)
      }
    }
    fetchColors()
  }, [])

  const fetchPrograms = async () => {
    setLoading(true)
    
    // Fetch products for status filtering
    const { data: productsData, error: productsError} = await supabase
      .from('products')
      .select('*')

    if (productsError) {
      console.error('Error fetching products:', productsError)
    } else {
      setProducts(productsData || [])
    }
    
    const { data: registrations, error } = await supabase
      .from('program_registrations')
      .select('program_name, status')

    if (error) {
      console.error('Error fetching registrations:', error)
      setLoading(false)
      return
    }

    // Normalize product name helper
    const normalizeProductName = (name: string): string => {
      return name
        .replace(/\s*-?\s*\d+\s*SPOTS?\s*LEFT/gi, '')
        .replace(/\s*-?\s*\d+%?\s*FULL/gi, '')
        .replace(/\s*-?\s*FULL\s*$/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Check if program is merchandise
    const isMerchandise = (programName: string): boolean => {
      const programLower = programName.toLowerCase()
      return !(
        programLower.includes('beginner hockey') ||
        programLower.includes('pre-beginner') ||
        programLower.includes('powerskating') ||
        programLower.includes('power skating') ||
        programLower.includes('shooting & puck handling') ||
        programLower.includes('shooting and puck handling') ||
        programLower.includes('goalie camp')
      )
    }

    // Check if program is active (product is published)
    const isProgramActive = (programName: string): boolean => {
      // Try exact match first
      let product = productsData?.find(p => normalizeProductName(p.name) === programName)
      
      // If no exact match, try fuzzy match (program name contains product name or vice versa)
      if (!product) {
        const normalizedProgram = normalizeProductName(programName).toLowerCase()
        product = productsData?.find(p => {
          const normalizedProduct = normalizeProductName(p.name).toLowerCase()
          return normalizedProgram.includes(normalizedProduct) || normalizedProduct.includes(normalizedProgram)
        })
      }
      
      return product ? product.status === 'publish' : false // Default to false if no product found (hide if not matched)
    }

    // Determine category for a program
    const getCategory = (programName: string): string => {
      const nameLower = programName.toLowerCase()
      if (nameLower.includes('beginner hockey') || nameLower.includes('pre-beginner')) {
        return 'Beginner Hockey'
      }
      if (nameLower.includes('powerskating') || nameLower.includes('power skating') ||
          nameLower.includes('shooting') || nameLower.includes('puck handling') || 
          nameLower.includes('goalie camp')) {
        return 'Skills Development'
      }
      return 'Other'
    }

    // Group by program and count
    const programMap = new Map<string, { total: number, active: number }>()
    
    registrations?.forEach(reg => {
      // Skip merchandise
      if (isMerchandise(reg.program_name)) return
      
      const current = programMap.get(reg.program_name) || { total: 0, active: 0 }
      current.total++
      if (reg.status === 'active') current.active++
      programMap.set(reg.program_name, current)
    })

    let programList: ProgramSummary[] = Array.from(programMap.entries()).map(([name, counts]) => ({
      name,
      count: counts.total,
      activeCount: counts.active,
      color: programColors[name],
      category: getCategory(name),
    }))

    // Filter by active/all based on program filter
    if (programFilter === 'active') {
      programList = programList.filter(program => isProgramActive(program.name))
    }

    // Sort by category first, then alphabetically within category
    programList.sort((a, b) => {
      if (a.category !== b.category) {
        // Sort categories: Beginner Hockey, Skills Development, Other
        const categoryOrder: {[key: string]: number} = {
          'Beginner Hockey': 1,
          'Skills Development': 2,
          'Other': 3
        }
        return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999)
      }
      return a.name.localeCompare(b.name)
    })
    
    setPrograms(programList)
    setLoading(false)
  }

  const saveColor = async (programName: string, color: string) => {
    await fetch('/api/program-colors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_name: programName, color })
    })
    
    // Update colors state
    setProgramColors(prev => ({ ...prev, [programName]: color }))
    
    // Update programs array with new color to trigger re-render
    setPrograms(prev => prev.map(p => 
      p.name === programName ? { ...p, color } : p
    ))
    
    setColoringProgram(null)
  }

  const syncRegistrations = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-registrations', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        alert(result.message)
        fetchPrograms()
      } else {
        alert('Failed to sync: ' + result.error)
      }
    } catch (error) {
      alert('Error syncing: ' + error)
    }
    setSyncing(false)
  }

  useEffect(() => {
    fetchPrograms()
  }, [programFilter])

  // Memoize program rendering to avoid recalculating categories on every render
  const programElements = useMemo(() => {
    let currentCategory = ''
    return programs.map((program) => {
      const showCategoryHeader = currentCategory !== program.category
      currentCategory = program.category
      
      return (
        <div key={program.name}>
          {showCategoryHeader && (
            <div style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #eee',
              fontWeight: '600',
              fontSize: '0.95rem',
              color: '#666',
            }}>
              {program.category}
            </div>
          )}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #eee',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
          >
            {/* Color dot - outside Link so click works */}
            <div
              onClick={(e) => {
                e.stopPropagation()
                setColoringProgram(program.name)
              }}
              style={{
                width: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Click to change color"
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: program.color || '#d1d5db',
                  border: '2px solid #e5e7eb',
                }}
              />
            </div>

            {/* Program details - clickable link */}
            <Link
              href={`/programs/${encodeURIComponent(program.name)}`}
              style={{
                flex: 1,
                display: 'block',
                padding: '1.5rem',
                paddingLeft: 0,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                    {program.name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {program.activeCount} active registrant{program.activeCount !== 1 ? 's' : ''}
                    {program.count !== program.activeCount && ` (${program.count} total)`}
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', color: '#0070f3' }}>→</div>
              </div>
            </Link>
          </div>
        </div>
      )
    })
  }, [programs, programColors])

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          📋 Programs
        </h1>
        <p style={{ color: '#666' }}>Manage program rosters and registrations</p>
      </div>

      {/* Sync Button */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={syncRegistrations}
          disabled={syncing}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: syncing ? '#ccc' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: '500',
          }}
        >
          {syncing ? 'Syncing...' : '🔄 Sync Registrations from Orders'}
        </button>

        <Link
          href="/orders"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            textDecoration: 'none',
            fontWeight: '500',
            display: 'inline-block',
          }}
        >
          ← Back to Orders
        </Link>
      </div>

      {/* Active/All Programs Filter */}
      <div style={{ 
        marginBottom: '2rem',
        padding: '0.75rem',
        backgroundColor: '#f0f9ff',
        borderRadius: '6px',
        border: '1px solid #bfdbfe'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
            <input
              type="radio"
              name="programFilter"
              checked={programFilter === 'active'}
              onChange={() => setProgramFilter('active')}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            Active Programs Only
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
            <input
              type="radio"
              name="programFilter"
              checked={programFilter === 'all'}
              onChange={() => setProgramFilter('all')}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            All Programs (including completed)
          </label>
        </div>
      </div>

      {/* Programs List */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #eee',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>All Programs</h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading programs...</div>
        ) : programs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
            No programs found. Click "Sync Registrations" to import from orders.
          </div>
        ) : (
          <div>
            {programElements}
          </div>
        )}
      </div>

      {/* Color Picker Modal */}
      {coloringProgram && (
        <div
          onClick={() => setColoringProgram(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '400px',
            }}
          >
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
              Choose Color for {coloringProgram}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                '#ef4444', // red
                '#f97316', // orange  
                '#f59e0b', // amber
                '#84cc16', // lime
                '#10b981', // emerald
                '#14b8a6', // teal
                '#06b6d4', // cyan
                '#0ea5e9', // sky
                '#3b82f6', // blue
                '#6366f1', // indigo
                '#8b5cf6', // violet
                '#a855f7', // purple
                '#ec4899', // pink
                '#f43f5e', // rose
                '#64748b', // slate
                '#d1d5db', // gray (default)
              ].map((color) => (
                <div
                  key={color}
                  onClick={() => saveColor(coloringProgram, color)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: color,
                    cursor: 'pointer',
                    border: '2px solid #e5e7eb',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>

            <button
              onClick={() => setColoringProgram(null)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
