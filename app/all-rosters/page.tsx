'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Registration {
  id: number
  program_name: string
  player_name: string
  status: string
}

interface ProgramSetting {
  program_name: string
  start_date: string
  status: string
}

interface ProgramRoster {
  program_name: string
  start_date: string
  players: Registration[]
  count: number
  capacity: number
}

export default function AllRostersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [programRosters, setProgramRosters] = useState<ProgramRoster[]>([])

  // Get capacity based on program name
  const getCapacity = (programName: string): number => {
    if (programName.includes('Beginner Hockey') && programName.includes('Player')) return 30
    if (programName.includes('Beginner Hockey') && programName.includes('Goalie')) return 4
    if (programName.includes('Power Skating')) return 16
    if (programName.includes('Shooting')) return 16
    return 20 // Default
  }

  // Get color based on capacity
  const getCapacityColor = (count: number, capacity: number): string => {
    if (count <= capacity) return '#000' // Black (normal)
    if (count <= 20) return '#f59e0b' // Yellow (17-20 over)
    return '#dc2626' // Red (21+ over)
  }

  // Format date without timezone conversion
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'No date set'
    const dateStr = dateString.split('T')[0]
    const [year, month, day] = dateStr.split('-')
    const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return localDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Group programs by type
  const groupPrograms = (rosters: ProgramRoster[]) => {
    const beginnerHockey: ProgramRoster[] = []
    const skillsDev: ProgramRoster[] = []

    rosters.forEach(roster => {
      if (roster.program_name.includes('Beginner Hockey')) {
        beginnerHockey.push(roster)
      } else {
        skillsDev.push(roster)
      }
    })

    // Sort by start_date within each group
    beginnerHockey.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    skillsDev.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    return { beginnerHockey, skillsDev }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // Fetch programs and registrations in PARALLEL (not sequential)
      const [programsResult, registrationsResult] = await Promise.all([
        supabase
          .from('program_settings')
          .select('*')
          .in('status', ['open_registration', 'in_progress'])
          .order('start_date', { ascending: true }),
        
        supabase
          .from('program_registrations')
          .select('*')
          .eq('status', 'active')
      ])

      if (programsResult.error) {
        console.error('Error fetching programs:', programsResult.error)
        setLoading(false)
        return
      }

      if (registrationsResult.error) {
        console.error('Error fetching registrations:', registrationsResult.error)
        setLoading(false)
        return
      }

      const programs = programsResult.data
      const registrations = registrationsResult.data

      // Group registrations by program
      const rosterMap: { [key: string]: ProgramRoster } = {}

      programs?.forEach((program: ProgramSetting) => {
        const programPlayers = registrations?.filter(
          (reg: Registration) => reg.program_name === program.program_name
        ) || []

        rosterMap[program.program_name] = {
          program_name: program.program_name,
          start_date: program.start_date,
          players: programPlayers,
          count: programPlayers.length,
          capacity: getCapacity(program.program_name)
        }
      })

      setProgramRosters(Object.values(rosterMap))
      setLoading(false)
    }

    fetchData()
  }, [])

  const { beginnerHockey, skillsDev } = groupPrograms(programRosters)

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading rosters...
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            📋 Master Roster - All Programs
          </h1>
          <p style={{ color: '#666' }}>All active registrants organized by program</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            🖨️ Print
          </button>
          <button
            onClick={() => router.push('/programs')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            ← Back to Programs
          </button>
        </div>
      </div>

      {/* Beginner Hockey Section */}
      {beginnerHockey.length > 0 && (
        <>
          <div style={{
            backgroundColor: '#1e40af',
            color: 'white',
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 'bold',
          }}>
            BEGINNER HOCKEY PROGRAMS
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem',
          }}>
            {beginnerHockey.map((roster) => (
              <div
                key={roster.program_name}
                style={{
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {/* Program Header */}
                <div style={{ marginBottom: '1rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {roster.program_name}
                  </h3>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {formatDate(roster.start_date)}
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: getCapacityColor(roster.count, roster.capacity),
                    }}
                  >
                    {roster.count}/{roster.capacity}
                  </div>
                </div>

                {/* Players List */}
                <div style={{ fontSize: '0.875rem' }}>
                  {roster.players.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No registrants yet</div>
                  ) : (
                    roster.players.map((player, index) => (
                      <div
                        key={player.id}
                        style={{
                          padding: '0.25rem 0',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        {index + 1}. {player.player_name}
                        {roster.program_name.includes('Goalie') && ' 🥅'}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Skills Development Section */}
      {skillsDev.length > 0 && (
        <>
          <div style={{
            backgroundColor: '#7c3aed',
            color: 'white',
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '6px',
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 'bold',
          }}>
            SKILLS DEVELOPMENT PROGRAMS
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {skillsDev.map((roster) => (
              <div
                key={roster.program_name}
                style={{
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {/* Program Header */}
                <div style={{ marginBottom: '1rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {roster.program_name}
                  </h3>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {formatDate(roster.start_date)}
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: getCapacityColor(roster.count, roster.capacity),
                    }}
                  >
                    {roster.count}/{roster.capacity}
                  </div>
                </div>

                {/* Players List */}
                <div style={{ fontSize: '0.875rem' }}>
                  {roster.players.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No registrants yet</div>
                  ) : (
                    roster.players.map((player, index) => (
                      <div
                        key={player.id}
                        style={{
                          padding: '0.25rem 0',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        {index + 1}. {player.player_name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {beginnerHockey.length === 0 && skillsDev.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem',
          color: '#6b7280',
        }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No active programs found</p>
          <p>Programs with status "open_registration" or "in_progress" will appear here</p>
        </div>
      )}
    </div>
  )
}
