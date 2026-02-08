'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'


interface ProgramSummary {
  name: string
  count: number
  activeCount: number
  category: string
  status: string
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'open_registration' | 'in_progress' | 'completed' | 'all'>('open_registration')
  const [programStatuses, setProgramStatuses] = useState<{[key: string]: string}>({})

  // Fetch statuses once on mount
  useEffect(() => {
    const fetchStatuses = async () => {
      // Fetch statuses
      const statusResponse = await fetch('/api/program-settings')
      const statusData = await statusResponse.json()
      if (statusData.settings) {
        const statusMap: {[key: string]: string} = {}
        statusData.settings.forEach((s: any) => {
          statusMap[s.program_name] = s.status
        })
        setProgramStatuses(statusMap)
      }
    }
    fetchStatuses()
  }, [])

  const fetchPrograms = async () => {
    setLoading(true)
    
    const { data: registrations, error } = await supabase
      .from('program_registrations')
      .select('program_name, status')

    if (error) {
      console.error('Error fetching registrations:', error)
      setLoading(false)
      return
    }

    // Helper to check if program is merchandise
    const isMerchandise = (programName: string): boolean => {
      const programLower = programName.toLowerCase()
      return programLower.includes('hoodie') || 
             programLower.includes('jersey') || 
             programLower.includes('merchandise') ||
             programLower.includes('apparel')
    }

    // Determine category for a program
    const getCategory = (programName: string): string => {
      const nameLower = programName.toLowerCase()
      if (nameLower.includes('beginner hockey') || nameLower.includes('pre-beginner')) {
        return 'Beginner Hockey'
      }
      if (nameLower.includes('powerskating') || nameLower.includes('power skating') ||
          nameLower.includes('shooting') || nameLower.includes('puck handling') || 
          nameLower.includes('goalie')) {
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
      category: getCategory(name),
      status: programStatuses[name] || 'open_registration', // Default to open_registration
    }))

    // Filter by status
    if (statusFilter !== 'all') {
      programList = programList.filter(program => program.status === statusFilter)
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

  const saveStatus = async (programName: string, status: string) => {
    await fetch('/api/program-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_name: programName, status })
    })
    
    // Update statuses state
    setProgramStatuses(prev => ({ ...prev, [programName]: status }))
    
    // Update programs array with new status
    setPrograms(prev => {
      const updated = prev.map(p => 
        p.name === programName ? { ...p, status } : p
      )
      
      // Apply current filter immediately
      if (statusFilter === 'all') {
        return updated
      } else {
        return updated.filter(p => p.status === statusFilter)
      }
    })
  }

  useEffect(() => {
    fetchPrograms()
  }, [statusFilter])

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
            {/* Status dropdown */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '180px',
                display: 'flex',
                alignItems: 'center',
                paddingRight: '1rem',
                flexShrink: 0,
              }}
            >
              <select
                value={program.status}
                onChange={(e) => {
                  e.stopPropagation()
                  saveStatus(program.name, e.target.value)
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  backgroundColor: program.status === 'open_registration' ? '#dcfce7' : 
                                   program.status === 'in_progress' ? '#dbeafe' : '#f3f4f6',
                }}
              >
                <option value="open_registration">Open Registration</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
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
  }, [programs])

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

      {/* Status Filter */}
      <div style={{ 
        marginBottom: '2rem',
        padding: '0.75rem',
        backgroundColor: '#f0f9ff',
        borderRadius: '6px',
        border: '1px solid #bfdbfe'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
            <input
              type="radio"
              name="statusFilter"
              checked={statusFilter === 'open_registration'}
              onChange={() => setStatusFilter('open_registration')}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            Open Registration
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
            <input
              type="radio"
              name="statusFilter"
              checked={statusFilter === 'in_progress'}
              onChange={() => setStatusFilter('in_progress')}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            In Progress
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
            <input
              type="radio"
              name="statusFilter"
              checked={statusFilter === 'completed'}
              onChange={() => setStatusFilter('completed')}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            Completed
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
            <input
              type="radio"
              name="statusFilter"
              checked={statusFilter === 'all'}
              onChange={() => setStatusFilter('all')}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            All Programs
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
    </div>
  )
}
