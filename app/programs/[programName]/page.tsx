'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Registration {
  id: number
  program_name: string
  player_name: string
  player_email: string
  player_phone: string
  order_id: number | null
  source: string
  payment_method: string
  amount: string
  status: string
  notes: string
  created_at: string
}

export default function ProgramRosterPage() {
  const params = useParams()
  const programName = decodeURIComponent(params.programName as string)
  
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [allPrograms, setAllPrograms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showRemoved, setShowRemoved] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Registration | null>(null)
  const [movingPlayer, setMovingPlayer] = useState<Registration | null>(null)
  
  // Form state
  const [playerName, setPlayerName] = useState('')
  const [playerEmail, setPlayerEmail] = useState('')
  const [playerPhone, setPlayerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('e-transfer')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  
  // Edit form state
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')


  const fetchRegistrations = async () => {
    setLoading(true)
    
    // Helper to check if program is merchandise
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
    
    // Fetch all unique program names for move dropdown
    const { data: allRegs, error: allRegsError } = await supabase
      .from('program_registrations')
      .select('program_name')

    if (!allRegsError) {
      const uniquePrograms = Array.from(new Set(allRegs?.map(r => r.program_name) || []))
        .filter(p => p !== programName && !isMerchandise(p)) // Exclude current program and merchandise
        .sort()
      setAllPrograms(uniquePrograms)
    }
    
    const { data, error } = await supabase
      .from('program_registrations')
      .select('*')
      .eq('program_name', programName)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching registrations:', error)
    } else {
      setRegistrations(data || [])
    }
    setLoading(false)
  }

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const { error } = await supabase
      .from('program_registrations')
      .insert({
        program_name: programName,
        player_name: playerName,
        player_email: playerEmail,
        player_phone: playerPhone,
        order_id: null,
        source: 'manual',
        payment_method: paymentMethod,
        amount: amount,
        status: 'active',
        notes: notes,
      })

    if (error) {
      alert('Error adding player: ' + error.message)
    } else {
      // Reset form
      setPlayerName('')
      setPlayerEmail('')
      setPlayerPhone('')
      setAmount('')
      setNotes('')
      setShowAddForm(false)
      fetchRegistrations()
    }
  }

  const removeRegistration = async (id: number, playerName: string) => {
    if (!confirm(`Remove ${playerName} from this program? (Can be restored later)`)) return

    const { error } = await supabase
      .from('program_registrations')
      .update({ status: 'removed' })
      .eq('id', id)

    if (error) {
      alert('Error removing player: ' + error.message)
    } else {
      fetchRegistrations()
    }
  }

  const restoreRegistration = async (id: number, playerName: string) => {
    const { error } = await supabase
      .from('program_registrations')
      .update({ status: 'active' })
      .eq('id', id)

    if (error) {
      alert('Error restoring player: ' + error.message)
    } else {
      fetchRegistrations()
    }
  }

  const startEdit = (reg: Registration) => {
    setEditingPlayer(reg)
    setEditName(reg.player_name)
    setEditEmail(reg.player_email || '')
    setEditPhone(reg.player_phone || '')
  }

  const saveEdit = async () => {
    if (!editingPlayer) return

    const { error } = await supabase
      .from('program_registrations')
      .update({
        player_name: editName,
        player_email: editEmail,
        player_phone: editPhone,
      })
      .eq('id', editingPlayer.id)

    if (error) {
      alert('Error updating player: ' + error.message)
    } else {
      setEditingPlayer(null)
      fetchRegistrations()
    }
  }

  const startMove = (reg: Registration) => {
    if (allPrograms.length === 0) {
      alert('No other programs available to move to.')
      return
    }
    setMovingPlayer(reg)
  }

  const confirmMove = async (targetProgram: string) => {
    if (!movingPlayer) return

    const { error: insertError } = await supabase
      .from('program_registrations')
      .insert({
        program_name: targetProgram,
        player_name: movingPlayer.player_name,
        player_email: movingPlayer.player_email,
        player_phone: movingPlayer.player_phone,
        order_id: movingPlayer.order_id,
        source: 'transfer',
        payment_method: movingPlayer.payment_method,
        amount: movingPlayer.amount,
        status: 'active',
        notes: `Transferred from "${programName}" on ${new Date().toLocaleDateString()}`,
      })

    if (insertError) {
      alert('Error moving player: ' + insertError.message)
      return
    }

    const { error: updateError } = await supabase
      .from('program_registrations')
      .update({ status: 'transferred_out' })
      .eq('id', movingPlayer.id)

    if (updateError) {
      alert('Error updating old registration: ' + updateError.message)
    } else {
      alert(`✓ ${movingPlayer.player_name} successfully moved to ${targetProgram}`)
      setMovingPlayer(null)
      fetchRegistrations()
    }
  }

  const moveRegistration = async (id: number, playerName: string, currentProgram: string) => {
    if (allPrograms.length === 0) {
      alert('No other programs available to move to.')
      return
    }

    // Create numbered list for easier selection
    const programList = allPrograms.map((p, i) => `${i + 1}. ${p}`).join('\n')
    const selection = prompt(
      `Move ${playerName} to which program?\n\n${programList}\n\nEnter the NUMBER or full program name:`
    )
    
    if (!selection) return
    
    // Check if user entered a number
    const selectionNum = parseInt(selection)
    let targetProgram: string
    
    if (!isNaN(selectionNum) && selectionNum >= 1 && selectionNum <= allPrograms.length) {
      targetProgram = allPrograms[selectionNum - 1]
    } else {
      // User typed program name
      targetProgram = selection
      if (!allPrograms.includes(targetProgram)) {
        alert('Invalid selection. Please enter a number (1-' + allPrograms.length + ') or exact program name.')
        return
      }
    }

    if (!confirm(`Move ${playerName} from:\n"${currentProgram}"\n\nTo:\n"${targetProgram}"\n\nConfirm?`)) return

    // Get the registration details
    const reg = registrations.find(r => r.id === id)
    if (!reg) return

    const { error: insertError } = await supabase
      .from('program_registrations')
      .insert({
        program_name: targetProgram,
        player_name: reg.player_name,
        player_email: reg.player_email,
        player_phone: reg.player_phone,
        order_id: reg.order_id,
        source: 'transfer',
        payment_method: reg.payment_method,
        amount: reg.amount,
        status: 'active',
        notes: `Transferred from "${currentProgram}" on ${new Date().toLocaleDateString()}`,
      })

    if (insertError) {
      alert('Error moving player: ' + insertError.message)
      return
    }

    // Mark old registration as transferred_out
    const { error: updateError } = await supabase
      .from('program_registrations')
      .update({ status: 'transferred_out' })
      .eq('id', id)

    if (updateError) {
      alert('Error updating old registration: ' + updateError.message)
    } else {
      alert(`✓ ${playerName} successfully moved to:\n${targetProgram}`)
      fetchRegistrations()
    }
  }

  const copyEmails = () => {
    const emails = registrations
      .filter(r => r.status === 'active' && r.player_email)
      .map(r => r.player_email)
      .join(', ')

    navigator.clipboard.writeText(emails)
    alert(`✓ ${emails.split(', ').length} emails copied to clipboard!`)
  }

  const exportRoster = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Payment Method', 'Amount', 'Status', 'Source', 'Notes'].join(','),
      ...registrations.map(r => [
        r.player_name,
        r.player_email || '',
        r.player_phone || '',
        r.payment_method,
        r.amount,
        r.status,
        r.source,
        r.notes || '',
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${programName.replace(/[^a-z0-9]/gi, '_')}_roster.csv`
    a.click()
  }

  useEffect(() => {
    fetchRegistrations()
  }, [programName])

  const activeCount = registrations.filter(r => r.status === 'active').length
  const removedCount = registrations.filter(r => r.status === 'removed' || r.status === 'transferred_out').length
  
  // Filter registrations based on showRemoved toggle
  const displayedRegistrations = showRemoved 
    ? registrations 
    : registrations.filter(r => r.status === 'active')

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href="/programs"
          style={{
            color: '#0070f3',
            textDecoration: 'none',
            fontSize: '0.9rem',
            marginBottom: '0.5rem',
            display: 'inline-block',
          }}
        >
          ← Back to Programs
        </Link>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {programName}
        </h1>
        <p style={{ color: '#666' }}>
          {activeCount} active registrant{activeCount !== 1 ? 's' : ''} 
          {registrations.length !== activeCount && ` (${registrations.length} total)`}
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          {showAddForm ? '✕ Cancel' : '+ Add Player'}
        </button>

        <button
          onClick={copyEmails}
          disabled={activeCount === 0}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: activeCount === 0 ? '#ccc' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: activeCount === 0 ? 'not-allowed' : 'pointer',
            fontWeight: '500',
          }}
        >
          Copy Emails
        </button>

        <button
          onClick={exportRoster}
          disabled={registrations.length === 0}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: registrations.length === 0 ? '#ccc' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: registrations.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: '500',
          }}
        >
          Export Roster
        </button>

        {removedCount > 0 && (
          <button
            onClick={() => setShowRemoved(!showRemoved)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: showRemoved ? '#ef4444' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {showRemoved ? `Hide Removed (${removedCount})` : `Show Removed (${removedCount})`}
          </button>
        )}
      </div>

      {/* Add Player Form */}
      {showAddForm && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Add Player Manually</h3>
          <form onSubmit={addPlayer}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={playerEmail}
                  onChange={(e) => setPlayerEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={playerPhone}
                  onChange={(e) => setPlayerPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Payment Method *
                </label>
                <select
                  required
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                >
                  <option value="e-transfer">E-transfer</option>
                  <option value="cash">Cash</option>
                  <option value="comp">Comp/Free</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Amount
                </label>
                <input
                  type="text"
                  placeholder="$250"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Add to Roster
            </button>
          </form>
        </div>
      )}

      {/* Roster Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #eee',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Roster</h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading roster...</div>
        ) : registrations.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
            No registrations yet. Add players manually or sync from orders.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9f9f9' }}>
                <tr>
                  <th style={tableHeaderStyle}>#</th>
                  <th style={tableHeaderStyle}>Name</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Phone</th>
                  <th style={tableHeaderStyle}>Payment</th>
                  <th style={tableHeaderStyle}>Amount</th>
                  <th style={tableHeaderStyle}>Source</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedRegistrations.map((reg, index) => (
                  <tr key={reg.id} style={{ 
                    borderBottom: '1px solid #eee',
                    opacity: reg.status === 'active' ? 1 : 0.6,
                    backgroundColor: reg.status === 'active' ? 'white' : '#f9fafb'
                  }}>
                    <td style={tableCellStyle}>{index + 1}</td>
                    <td style={tableCellStyle}>{reg.player_name}</td>
                    <td style={tableCellStyle}>{reg.player_email || '-'}</td>
                    <td style={tableCellStyle}>{reg.player_phone || '-'}</td>
                    <td style={tableCellStyle}>
                      {reg.source === 'order' ? (
                        <span>Order #{reg.order_id}</span>
                      ) : (
                        <span style={{ textTransform: 'capitalize' }}>{reg.payment_method}</span>
                      )}
                    </td>
                    <td style={tableCellStyle}>${reg.amount}</td>
                    <td style={tableCellStyle}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        backgroundColor: reg.source === 'order' ? '#dbeafe' : '#fef3c7',
                        color: reg.source === 'order' ? '#1e40af' : '#92400e',
                      }}>
                        {reg.source}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        backgroundColor: reg.status === 'active' ? '#d4edda' : '#f8d7da',
                        color: reg.status === 'active' ? '#155724' : '#721c24',
                      }}>
                        {reg.status}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {reg.status === 'active' && (
                          <>
                            <button
                              onClick={() => startEdit(reg)}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: '#8b5cf6',
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
                              onClick={() => startMove(reg)}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: '#0070f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                              }}
                            >
                              Move
                            </button>
                            <button
                              onClick={() => removeRegistration(reg.id, reg.player_name)}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </>
                        )}
                        {(reg.status === 'removed' || reg.status === 'transferred_out') && (
                          <button
                            onClick={() => restoreRegistration(reg.id, reg.player_name)}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                            }}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
          }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: '600' }}>
              Edit Player
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Name *
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Email
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Phone
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingPlayer(null)}
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
                onClick={saveEdit}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Player Modal */}
      {movingPlayer && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
              Move {movingPlayer.player_name}
            </h3>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              Select the program to move this player to:
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              {allPrograms.map((program) => (
                <button
                  key={program}
                  onClick={() => confirmMove(program)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f9ff'
                    e.currentTarget.style.borderColor = '#0070f3'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = '#ddd'
                  }}
                >
                  {program}
                </button>
              ))}
            </div>

            <button
              onClick={() => setMovingPlayer(null)}
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
          </div>
        </div>
      )}
    </div>
  )
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '0.875rem',
  color: '#4a5568',
  borderBottom: '2px solid #e2e8f0',
}

const tableCellStyle: React.CSSProperties = {
  padding: '1rem',
  fontSize: '0.875rem',
}
