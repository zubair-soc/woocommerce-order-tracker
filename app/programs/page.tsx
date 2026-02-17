'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
  email_template?: string
}

export default function ProgramsPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
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
  const [viewingTemplate, setViewingTemplate] = useState(false)
  const [emailTemplate, setEmailTemplate] = useState('')
  
  // Template Library
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [editTemplateName, setEditTemplateName] = useState('')
  const [editTemplateDesc, setEditTemplateDesc] = useState('')
  const [editTemplateHtml, setEditTemplateHtml] = useState('')

  // Save filter to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('programStatusFilter', statusFilter)
    }
  }, [statusFilter])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
          notes: s.notes,
          email_template: s.email_template
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
        notes: settings.notes,
        email_template: settings.email_template
      }
    })

    // Filter out "Other" category (merchandise that slipped through whitelist)
    programList = programList.filter(p => p.category !== 'Other')

    // Filter by status
    if (statusFilter !== 'all') {
      programList = programList.filter(program => program.status === statusFilter)
    }

    // Sort by category first, then start date, then alphabetically
    programList.sort((a, b) => {
      if (a.category !== b.category) {
        // Sort categories: Beginner Hockey, Skills Development
        const categoryOrder: {[key: string]: number} = {
          'Beginner Hockey': 1,
          'Skills Development': 2,
        }
        return (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999)
      }
      
      // Within same category, sort by start_date first (earliest first)
      if (a.start_date && b.start_date) {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      }
      // Programs with dates come before programs without dates
      if (a.start_date && !b.start_date) return -1
      if (!a.start_date && b.start_date) return 1
      
      // If no dates, sort alphabetically
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


  const openEditModal = (program: ProgramSummary) => {
    setEditingProgram(program.name)
    setEditStartDate(program.start_date || '')
    setEditNotes(program.notes || '')
    setEmailTemplate(program.email_template || '')
  }

  // Template Library Functions
  const fetchTemplates = async () => {
    const response = await fetch('/api/email-templates')
    const data = await response.json()
    setTemplates(data.templates || [])
  }

  const openTemplateLibrary = () => {
    fetchTemplates()
    setShowTemplateLibrary(true)
  }

  const openTemplateEditor = (template?: any) => {
    if (template) {
      setEditingTemplateId(template.id)
      setEditTemplateName(template.name)
      setEditTemplateDesc(template.description || '')
      setEditTemplateHtml(template.template_html)
    } else {
      // For new template, set a flag to show modal
      setEditingTemplateId(0) // Use 0 to indicate "new template mode"
      setEditTemplateName('')
      setEditTemplateDesc('')
      setEditTemplateHtml('')
    }
  }

  const saveTemplate = async () => {
    if (!editTemplateName || !editTemplateHtml) {
      alert('Name and template HTML are required')
      return
    }

    console.log('Saving template:', {
      id: editingTemplateId,
      name: editTemplateName,
      description: editTemplateDesc,
      descLength: editTemplateDesc?.length
    })

    const response = await fetch('/api/email-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingTemplateId && editingTemplateId !== 0 ? editingTemplateId : null, // Don't send 0 as id
        name: editTemplateName,
        description: editTemplateDesc || null,
        template_html: editTemplateHtml,
      })
    })

    const result = await response.json()
    console.log('Save result:', result)

    // Close modal and clear form
    setEditingTemplateId(null)
    setEditTemplateName('')
    setEditTemplateDesc('')
    setEditTemplateHtml('')
    
    // Refresh template list
    fetchTemplates()
    alert('✅ Template saved!')
  }

  const deleteTemplate = async (id: number, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return

    await fetch(`/api/email-templates?id=${id}`, { method: 'DELETE' })
    fetchTemplates()
    alert('✅ Template deleted')
  }

  const copyTemplate = async (html: string, name: string) => {
    await navigator.clipboard.writeText(html)
    alert(`✅ "${name}" copied to clipboard!`)
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
      
      // Mobile Card View
      if (isMobile) {
        return (
          <div key={program.name}>
            {showCategoryHeader && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#f9fafb',
                fontWeight: '600',
                fontSize: '0.9rem',
                color: '#666',
                marginTop: '1rem',
              }}>
                {program.category}
              </div>
            )}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '0.75rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              {/* Clickable area - program details */}
              <Link
                href={`/programs/${encodeURIComponent(program.name)}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  marginBottom: '0.75rem',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, marginBottom: '0.5rem' }}>
                  {program.name}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#666' }}>
                  <span>{program.activeCount} active</span>
                  {program.count !== program.activeCount && (
                    <span>({program.count - program.activeCount} removed)</span>
                  )}
                </div>
                {program.start_date && (
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    Start: {new Date(program.start_date).toLocaleDateString()}
                  </div>
                )}
                {program.notes && (
                  <div style={{ 
                    fontSize: '0.813rem', 
                    color: '#666', 
                    marginTop: '0.5rem',
                    fontStyle: 'italic',
                    padding: '0.5rem',
                    backgroundColor: '#fef3c7',
                    borderRadius: '4px',
                  }}>
                    {program.notes}
                  </div>
                )}
              </Link>
              
              {/* Status and Edit - separate from link */}
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <select
                  value={program.status}
                  onChange={(e) => {
                    saveStatus(program.name, e.target.value)
                  }}
                  style={{
                    flex: 1,
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
                <button
                  onClick={(e) => {
                    openEditModal(program)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'white',
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
            </div>
          </div>
        )
      }
      
      // Desktop Row View
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
  }, [programs, isMobile])

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

        <button
          onClick={() => router.push('/all-rosters')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          📋 View All Rosters
        </button>

        <button
          onClick={openTemplateLibrary}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          📧 Email Templates
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

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                📧 Email Template
              </label>
              <button
                onClick={() => setViewingTemplate(true)}
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: emailTemplate ? '#10b981' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {emailTemplate ? '📄 View/Edit Template' : '➕ Add Template'}
              </button>
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

      {/* Email Template Modal */}
      {viewingTemplate && (
        <div
          onClick={() => setViewingTemplate(false)}
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
            zIndex: 1001,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
              📧 Email Template: {editingProgram}
            </h3>

            <textarea
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              placeholder="Paste your HTML email template here..."
              style={{
                flex: 1,
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                resize: 'none',
                marginBottom: '1.5rem',
              }}
            />

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setViewingTemplate(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(emailTemplate)
                  alert('✅ Template copied to clipboard!')
                }}
                disabled={!emailTemplate}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: emailTemplate ? '#10b981' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: emailTemplate ? 'pointer' : 'not-allowed',
                }}
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={async () => {
                  await fetch('/api/program-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      program_name: editingProgram,
                      email_template: emailTemplate || null,
                    })
                  })
                  setViewingTemplate(false)
                  alert('✅ Template saved!')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Library Modal */}
      {showTemplateLibrary && (
        <div
          onClick={() => setShowTemplateLibrary(false)}
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
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                📧 Email Template Library
              </h2>
              <button
                onClick={() => setShowTemplateLibrary(false)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ✕
              </button>
            </div>

            <button
              onClick={() => openTemplateEditor()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                cursor: 'pointer',
                marginBottom: '1.5rem',
                fontWeight: '500',
              }}
            >
              + New Template
            </button>

            {templates.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                No templates yet. Click "New Template" to add one.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {templates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      padding: '1.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, marginBottom: '0.25rem' }}>
                          {template.name}
                        </h3>
                        {template.description && (
                          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openTemplateEditor(template)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => copyTemplate(template.template_html, template.name)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                          }}
                        >
                          📋 Copy
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id, template.name)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {editingTemplateId !== null ? (
        <div
          onClick={() => setEditingTemplateId(null)}
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
            zIndex: 1001,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                {editingTemplateId ? 'Edit Template' : 'New Template'}
              </h3>
              <button
                onClick={() => {
                  setEditingTemplateId(null)
                  setEditTemplateName('')
                  setEditTemplateDesc('')
                  setEditTemplateHtml('')
                }}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Template Name *
              </label>
              <input
                type="text"
                value={editTemplateName}
                onChange={(e) => setEditTemplateName(e.target.value)}
                placeholder="e.g., Power Skating"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Description
              </label>
              <input
                type="text"
                value={editTemplateDesc}
                onChange={(e) => setEditTemplateDesc(e.target.value)}
                placeholder="e.g., Used for all Power Skating sessions"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ flex: 1, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                HTML Template *
              </label>
              <textarea
                value={editTemplateHtml}
                onChange={(e) => setEditTemplateHtml(e.target.value)}
                placeholder="Paste your HTML email template here..."
                style={{
                  flex: 1,
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  resize: 'none',
                  minHeight: '300px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setEditingTemplateId(null)
                  setEditTemplateName('')
                  setEditTemplateDesc('')
                  setEditTemplateHtml('')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
