'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ProgramSummary {
  name: string
  count: number
  activeCount: number
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [programFilter, setProgramFilter] = useState<'active' | 'all'>('active')

  const fetchPrograms = async () => {
    setLoading(true)
    
    // Fetch products for status filtering
    const { data: productsData, error: productsError } = await supabase
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

    // Check if program is active (product is published)
    const isProgramActive = (programName: string): boolean => {
      const product = productsData?.find(p => normalizeProductName(p.name) === programName)
      return product ? product.status === 'publish' : false
    }

    // Group by program and count
    const programMap = new Map<string, { total: number, active: number }>()
    
    registrations?.forEach(reg => {
      const current = programMap.get(reg.program_name) || { total: 0, active: 0 }
      current.total++
      if (reg.status === 'active') current.active++
      programMap.set(reg.program_name, current)
    })

    let programList: ProgramSummary[] = Array.from(programMap.entries()).map(([name, counts]) => ({
      name,
      count: counts.total,
      activeCount: counts.active,
    }))

    // Filter by active/all based on program filter
    if (programFilter === 'active') {
      programList = programList.filter(program => isProgramActive(program.name))
    }

    programList.sort((a, b) => a.name.localeCompare(b.name))
    setPrograms(programList)
    setLoading(false)
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
            {programs.map((program) => (
              <Link
                key={program.name}
                href={`/programs/${encodeURIComponent(program.name)}`}
                style={{
                  display: 'block',
                  padding: '1.5rem',
                  borderBottom: '1px solid #eee',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
