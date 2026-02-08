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
  display_order: number
  start_date?: string
  notes?: string
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'open_registration' | 'in_progress' | 'completed' | 'archived' | 'all'>(() => {
    // Restore filter from sessionStorage on mount (handles back button)
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('programStatusFilter')
      if (saved && ['open_registration', 'in_progress', 'completed', 'archived', 'all'].includes(saved)) {
        return saved as any
      }
    }
    return 'open_registration'
  })
  const [programStatuses, setProgramStatuses] = useState<{[key: string]: string}>({})
  const [editingProgram, setEditingProgram] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Save filter to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('programStatusFilter', statusFilter)
    }
  }, [statusFilter])

  const fetchPrograms = async () => {
    setLoading(true)
    
    // Fetch fresh program settings from database every time
    const statusResponse = await fetch('/api/program-settings')
    const statusData = await statusResponse.json()
    const freshStatuses: {[key: string]: string} = {}
    const programSettings: {[key: string]: any} = {}
    if (statusData.settings) {
      statusData.settings.forEach((s: any) => {
        freshStatuses[s.program_name] = s.status
        programSettings[s.program_name] = {
          status: s.status,
          display_order: s.display_order || 999,
          start_date: s.start_date,
          notes: s.notes
        }
      })
      setProgramStatuses(freshStatuses) // Update state too
    }
    
    const { data: registrations, error } = await supabase
      .from('program_registrations')
      .select('program_name, status')

    if (error) {
      console.error('Error fetching registrations:', error)
      setLoading(false)
      return
    }

    // Whitelist of actual programs (not merchandise)
    const isActualProgram = (programName: string): boolean => {
      const nameLower = programName.toLowerCase()
      return nameLower.includes('beginner hockey') ||
             nameLower.includes('pre-beginner') ||
             nameLower.includes('powerskating') ||
             nameLower.includes('power skating') ||
             nameLower.includes('shooting') ||
             nameLower.includes('puck handling') ||
             nameLower.includes('goalie')
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
      // Skip if not an actual program (whitelist approach)
      if (!isActualProgram(reg.program_name)) return
      
      const current = programMap.get(reg.program_name) || { total: 0, active: 0 }
      current.total++
      if (reg.status === 'active') current.active++
      programMap.set(reg.program_name, current)
    })

    let programList: ProgramSummary[] = Array.from(programMap.entries()).map(([name, counts]) => {
      const settings = programSettings[name] || {}
      return {
        name,
        count: counts.total,
        activeCount: counts.active,
        category: getCategory(name),
        status: settings.status || 'open_registration',
        display_order: settings.display_order || 999,
        start_date: settings.start_date,
        notes: settings.notes
      }
    })

    // Filter out "Other" category (merchandise that slipped through whitelist)
    programList = programList.filter(p => p.category !== 'Other')

    // Filter by status
    if (statusFilter !== 'all') {
      programList = programList.filter(program => program.status === statusFilter)
    }

    // Sort by category first, then display_order, then alphabetically
    programList.sort((a, b) => {
      if (a.category !== b.category) {
        // Sort categories: Beginner Hockey, Skills Development
        const categoryOrder: {[key: string]: number} = {
          'Beginner Hockey': 1,
          'Skills Development': 2,
        }
        return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999)
      }
      // Within same category, sort by display_order first, then alphabetically
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order
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

  const moveProgram = async (programName: string, direction: 'up' | 'down') => {
    const currentIndex = programs.findIndex(p => p.name === programName)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= programs.length) return
    
    // Check if both programs are in same category
    if (programs[currentIndex].category !== programs[targetIndex].category) return
    
    // Get all programs in the same category
    const category = programs[currentIndex].category
    const categoryPrograms = programs.filter(p => p.category === category)
    
    // Find positions within category
    const currentCategoryIndex = categoryPrograms.findIndex(p => p.name === programName)
    const targetCategoryIndex = direction === 'up' ? currentCategoryIndex - 1 : currentCategoryIndex + 1
    
    if (targetCategoryIndex < 0 || targetCategoryIndex >= categoryPrograms.length) return
    
    // Assign new sequential display orders to entire category
    const updates = categoryPrograms.map((prog, idx) => {
      let newOrder = idx * 10 // Space them out (0, 10, 20, 30...)
      
      // Swap positions
      if (idx === currentCategoryIndex) {
        newOrder = targetCategoryIndex * 10
      } else if (idx === targetCategoryIndex) {
        newOrder = currentCategoryIndex * 10
      }
      
      return {
        program_name: prog.name,
        display_order: newOrder
      }
    })
    
    // Update all programs in category
    for (const update of updates) {
      await fetch('/api/program-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      })
    }
    
    // Re-fetch to get updated order
    fetchPrograms()
  }

  const openEditModal = (program: ProgramSummary) => {
    setEditingProgram(program.name)
    setEditStartDate(program.start_date || '')
    setEditNotes(program.notes || '')
  }

  const saveEdit = async () => {
    if (!editingProgram) return
    
    await fetch('/api/program-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        program_name: editingProgram,
        start_date: editStartDate || null,
        notes: editNotes || null
      })
    })
    
    // Update local state
    setPrograms(prev => prev.map(p => 
      p.name === editingProgram 
        ? { ...p, start_date: editStartDate, notes: editNotes }
        : p
    ))
    
    setEditingProgram(null)
    setEditStartDate('')
    setEditNotes('')
  }

  useEffect(() => {
    fetchPrograms()
  }, [statusFilter])

  // Also fetch on initial mount (handles back button)
  useEffect(() => {
    fetchPrograms()
  }, [])

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
            {/* Up/Down arrows */}
            <div style={{
              display: 'flex',
              gap: '0.25rem',
              padding: '0 0.75rem',
              alignItems: 'center',
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  moveProgram(program.name, 'up')
                }}
                disabled={programs.indexOf(program) === 0 || 
                         (programs.indexOf(program) > 0 && programs[programs.indexOf(program) - 1].category !== program.category)}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  opacity: (programs.indexOf(program) === 0 || 
                           (programs.indexOf(program) > 0 && programs[programs.indexOf(program) - 1].category !== program.category)) ? 0.3 : 1,
                }}
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  moveProgram(program.name, 'down')
                }}
                disabled={programs.indexOf(program) === programs.length - 1 || 
                         (programs.indexOf(program) < programs.length - 1 && programs[programs.indexOf(program) + 1].category !== program.category)}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  opacity: (programs.indexOf(program) === programs.length - 1 || 
                           (programs.indexOf(program) < programs.length - 1 && programs[programs.indexOf(program) + 1].category !== program.category)) ? 0.3 : 1,
                }}
                title="Move down"
              >
                ↓
              </button>
            </div>

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
                  backgroundColor: program.status === 'open_registration' ? '#f0fdf4' : 
                                   program.status === 'in_progress' ? '#fef9c3' : 
                                   program.status === 'archived' ? '#fafafa' : '#f3f4f6',
                }}
              >
                <option value="open_registration">Open Registration</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Edit button */}
            <div style={{ 
              padding: '0 0.75rem',
              display: 'flex',
              alignItems: 'center',
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEditModal(program)
                }}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
                title="Edit start date and notes"
              >
                ✏️
              </button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {program.start_date && (() => {
                    // Fix timezone by parsing date components directly
                    const dateStr = program.start_date.split('T')[0]
                    const [year, month, day] = dateStr.split('-')
                    const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                    
                    // Check if within 10 days
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const diffTime = localDate.getTime() - today.getTime()
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                    const isNearStart = diffDays >= 0 && diffDays <= 10
                    
                    return (
                      <div style={{
                        fontSize: '0.875rem',
                        color: isNearStart ? '#dc2626' : '#666',
                        fontWeight: isNearStart ? '600' : '400',
                      }}>
                        📅 {localDate.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    )
                  })()}
                  <div style={{ fontSize: '1.5rem', color: '#0070f3' }}>→</div>
                </div>
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
              checked={statusFilter === 'archived'}
              onChange={() => setStatusFilter('archived')}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            Archived
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

      {/* Edit Modal */}
      {editingProgram && (
        <div
          onClick={() => setEditingProgram(null)}
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
              maxWidth: '500px',
              width: '90%',
            }}
          >
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: '600' }}>
              Edit: {editingProgram}
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Start Date
              </label>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
                placeholder="Add notes about this program..."
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingProgram(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
