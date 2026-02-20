'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Credit {
  id: number
  player_name: string
  player_email: string
  amount: number
  reason: string
  created_by: string
  created_at: string
  status: 'active' | 'used'
  used_by?: string
  used_at?: string
  used_on_program?: string
  notes?: string
}

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUsed, setShowUsed] = useState(false)
  
  // Form state
  const [playerName, setPlayerName] = useState('')
  const [playerEmail, setPlayerEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  
  // Mark as used form state
  const [markingUsed, setMarkingUsed] = useState<Credit | null>(null)
  const [usedBy, setUsedBy] = useState('')
  const [usedOnProgram, setUsedOnProgram] = useState('')
  const [usedNotes, setUsedNotes] = useState('')

  const fetchCredits = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customer_credits')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching credits:', error)
    } else {
      setCredits(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCredits()
  }, [])

  const addCredit = async () => {
    if (!playerName || !amount || !reason || !createdBy) {
      alert('Please fill in all required fields')
      return
    }

    const { error } = await supabase
      .from('customer_credits')
      .insert([{
        player_name: playerName,
        player_email: playerEmail,
        amount: parseFloat(amount),
        reason: reason,
        created_by: createdBy,
        status: 'active'
      }])
    
    if (error) {
      alert('Error adding credit: ' + error.message)
    } else {
      // Reset form
      setPlayerName('')
      setPlayerEmail('')
      setAmount('')
      setReason('')
      setCreatedBy('')
      setShowAddForm(false)
      fetchCredits()
    }
  }

  const markAsUsed = async () => {
    if (!markingUsed || !usedBy) {
      alert('Please enter your name')
      return
    }

    const { error } = await supabase
      .from('customer_credits')
      .update({
        status: 'used',
        used_by: usedBy,
        used_at: new Date().toISOString(),
        used_on_program: usedOnProgram || null,
        notes: usedNotes || null
      })
      .eq('id', markingUsed.id)
    
    if (error) {
      alert('Error marking credit as used: ' + error.message)
    } else {
      setMarkingUsed(null)
      setUsedBy('')
      setUsedOnProgram('')
      setUsedNotes('')
      fetchCredits()
    }
  }

  const deleteCredit = async (id: number, playerName: string) => {
    const signOff = prompt(`Enter your name to confirm deleting credit for ${playerName}:`)
    if (!signOff) return

    const { error } = await supabase
      .from('customer_credits')
      .delete()
      .eq('id', id)
    
    if (error) {
      alert('Error deleting credit: ' + error.message)
    } else {
      fetchCredits()
    }
  }

  // Filter credits
  const filteredCredits = credits.filter(credit => {
    const matchesSearch = !searchTerm || 
      credit.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credit.player_email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = showUsed || credit.status === 'active'
    
    return matchesSearch && matchesStatus
  })

  const activeCredits = filteredCredits.filter(c => c.status === 'active')
  const usedCredits = filteredCredits.filter(c => c.status === 'used')
  const totalActiveAmount = activeCredits.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            💰 Customer Credits
          </h1>
          <Link
            href="/orders"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6b7280',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            ← Back to Orders
          </Link>
        </div>
        <p style={{ color: '#666' }}>
          Manage customer credits and track usage
        </p>
      </div>

      {/* Summary */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Active Credits</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>{activeCredits.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Total Amount</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>${totalActiveAmount.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Used Credits</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#6b7280' }}>{usedCredits.length}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: showAddForm ? '#6b7280' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Credit'}
        </button>

        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            flex: '1 1 300px',
          }}
        />

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          padding: '0.75rem',
        }}>
          <input
            type="checkbox"
            checked={showUsed}
            onChange={(e) => setShowUsed(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span>Show Used Credits</span>
        </label>
      </div>

      {/* Add Credit Form */}
      {showAddForm && (
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Add New Credit
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Player Name *
              </label>
              <input
                type="text"
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
                Email (Optional)
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
                Amount ($) *
              </label>
              <input
                type="number"
                step="0.01"
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

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Reason *
              </label>
              <input
                type="text"
                placeholder="e.g., Transfer from BH 1.0 to Power Skating"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
                Your Name (Sign-off) *
              </label>
              <input
                type="text"
                placeholder="e.g., YG"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={addCredit}
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
              Save Credit
            </button>
            <button
              onClick={() => setShowAddForm(false)}
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
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Credits List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #eee',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
            {showUsed ? 'All Credits' : 'Active Credits'}
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading credits...</div>
        ) : filteredCredits.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
            No credits found. Click "+ Add Credit" to create one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9f9f9' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Player</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Amount</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Reason</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Created By</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredits.map((credit) => (
                  <tr key={credit.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600' }}>{credit.player_name}</div>
                      {credit.player_email && (
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>{credit.player_email}</div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '700', color: '#10b981', fontSize: '1.1rem' }}>
                      ${credit.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div>{credit.reason}</div>
                      {credit.status === 'used' && credit.used_on_program && (
                        <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                          Used on: {credit.used_on_program}
                        </div>
                      )}
                      {credit.notes && (
                        <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          {credit.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>{credit.created_by}</td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#666' }}>
                      {new Date(credit.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {credit.status === 'active' ? (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          fontWeight: '600',
                        }}>
                          Active
                        </span>
                      ) : (
                        <div>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            fontWeight: '600',
                          }}>
                            Used
                          </span>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                            By: {credit.used_by}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            {new Date(credit.used_at!).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {credit.status === 'active' && (
                          <button
                            onClick={() => setMarkingUsed(credit)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            Mark Used
                          </button>
                        )}
                        <button
                          onClick={() => deleteCredit(credit.id, credit.player_name)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mark as Used Modal */}
      {markingUsed && (
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
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Mark Credit as Used
            </h2>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Player: {markingUsed.player_name}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981', marginBottom: '1rem' }}>
                Amount: ${markingUsed.amount.toFixed(2)}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Your Name (Sign-off) *
              </label>
              <input
                type="text"
                placeholder="e.g., YG"
                value={usedBy}
                onChange={(e) => setUsedBy(e.target.value)}
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
                Used On Program (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Power Skating 2.0"
                value={usedOnProgram}
                onChange={(e) => setUsedOnProgram(e.target.value)}
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
                Notes (Optional)
              </label>
              <textarea
                placeholder="Additional notes..."
                value={usedNotes}
                onChange={(e) => setUsedNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  minHeight: '80px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={markAsUsed}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setMarkingUsed(null)
                  setUsedBy('')
                  setUsedOnProgram('')
                  setUsedNotes('')
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
