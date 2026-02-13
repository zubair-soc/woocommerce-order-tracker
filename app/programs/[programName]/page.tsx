'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Registration = {
  id: number
  program_name: string
  player_name: string
  player_email: string
  order_id: string | null
  amount_paid: string
  status: string
  payment_status?: string
}

type ProgramSettings = {
  program_name: string
  start_date: string | null
  notes: string | null
}

export default function ProgramRosterPage() {
  const params = useParams()
  const router = useRouter()
  const programName = decodeURIComponent(params.programName as string)
  
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [settings, setSettings] = useState<ProgramSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRemoved, setShowRemoved] = useState(false)

  useEffect(() => {
    fetchData()
  }, [programName])

  async function fetchData() {
    setLoading(true)
    
    // Fetch registrations
    const { data: regData } = await supabase
      .from('program_registrations')
      .select('*')
      .eq('program_name', programName)
      .order('player_name', { ascending: true })
    
    // Fetch program settings
    const { data: settingsData } = await supabase
      .from('program_settings')
      .select('*')
      .eq('program_name', programName)
      .single()
    
    setRegistrations(regData || [])
    setSettings(settingsData)
    setLoading(false)
  }

  async function copyEmails() {
    const activeRegs = registrations.filter(r => r.status === 'active')
    const emails = activeRegs.map(r => r.player_email).join(', ')
    await navigator.clipboard.writeText(emails)
    alert(`Copied ${activeRegs.length} emails to clipboard`)
  }

  async function exportRoster() {
    alert('Export feature coming soon')
  }

  const activeRegistrations = registrations.filter(r => r.status === 'active')
  const removedRegistrations = registrations.filter(r => r.status === 'removed')
  const displayedRegistrations = showRemoved ? removedRegistrations : activeRegistrations

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date set'
    const [year, month, day] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: 'auto', fontFamily: 'sans-serif' }}>
      <Link href="/programs" style={{ color: '#007bff', textDecoration: 'none', fontSize: '14px' }}>
        ← Back to Programs
      </Link>

      <h1 style={{ marginTop: '20px', marginBottom: '10px' }}>{programName}</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        {activeRegistrations.length} active registrants ({registrations.length} total)
      </p>

      {/* Start Date Banner */}
      {settings?.start_date && (
        <div style={{
          background: '#f0f7ff',
          padding: '15px',
          borderRadius: '5px',
          border: '1px solid #cce5ff',
          marginBottom: '20px'
        }}>
          📅 <strong>Starts:</strong> {formatDate(settings.start_date)}
        </div>
      )}

      {/* Notes Banner */}
      {settings?.notes && (
        <div style={{
          background: '#fff3cd',
          padding: '15px',
          borderRadius: '5px',
          border: '1px solid #ffeaa7',
          marginBottom: '20px'
        }}>
          📝 <strong>Notes:</strong> {settings.notes}
        </div>
      )}

      {/* Action Buttons - Desktop */}
      <div className="top-actions">
        <button className="btn main-btn blue">+ Add Player</button>
        <button className="btn main-btn green" onClick={copyEmails}>Copy Emails</button>
        <button className="btn main-btn grey" onClick={exportRoster}>Export Roster</button>
        {removedRegistrations.length > 0 && (
          <button 
            className="btn main-btn orange" 
            onClick={() => setShowRemoved(!showRemoved)}
          >
            {showRemoved ? 'Show Active' : `Show Removed (${removedRegistrations.length})`}
          </button>
        )}
      </div>

      {/* Action Buttons - Mobile Grid */}
      <div className="mobile-btn-grid mobile-only">
        <button className="btn main-btn blue">+ Add</button>
        <button className="btn main-btn green" onClick={copyEmails}>Emails</button>
        <button className="btn main-btn grey" onClick={exportRoster}>Export</button>
        {removedRegistrations.length > 0 && (
          <button 
            className="btn main-btn orange" 
            onClick={() => setShowRemoved(!showRemoved)}
          >
            {showRemoved ? 'Active' : `Removed (${removedRegistrations.length})`}
          </button>
        )}
      </div>

      {/* Desktop Table */}
      <table className="desktop-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Payment</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayedRegistrations.map((reg, index) => (
            <tr key={reg.id}>
              <td>{index + 1}</td>
              <td><strong>{reg.player_name}</strong></td>
              <td style={{ fontSize: '13px' }}>{reg.player_email}</td>
              <td>{reg.order_id ? `Order #${reg.order_id}` : 'Manual Add'}</td>
              <td style={{ fontWeight: 'bold', color: '#28a745' }}>{reg.amount_paid}</td>
              <td>
                <span className={`status-${reg.status}`}>
                  {reg.status}
                </span>
              </td>
              <td>
                <button className="btn btn-edit">Edit</button>
                <button className="btn btn-move">Move</button>
                <button className="btn btn-remove">Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Cards */}
      <div className="mobile-only">
        {displayedRegistrations.map((reg, index) => (
          <div key={reg.id} className="card">
            <div className="card-row">
              <strong>{index + 1}. {reg.player_name}</strong>
              <span className={`status-${reg.status}`}>{reg.status}</span>
            </div>
            <div className="card-row">
              <span className="label">Email:</span>
              <span style={{ fontSize: '0.9em' }}>{reg.player_email}</span>
            </div>
            <div className="card-row">
              <span className="label">Payment:</span>
              <span>{reg.order_id ? `Order #${reg.order_id}` : 'Manual'}</span>
            </div>
            <div className="card-row">
              <span className="label">Amount:</span>
              <span style={{ fontWeight: 'bold', color: '#28a745' }}>{reg.amount_paid}</span>
            </div>
            <div className="card-actions">
              <button className="btn btn-edit">Edit</button>
              <button className="btn btn-move">Move</button>
              <button className="btn btn-remove">Remove</button>
            </div>
          </div>
        ))}
      </div>

      {loading && <p>Loading roster...</p>}

      <style jsx>{`
        /* Shared Styles */
        .btn {
          border: none;
          border-radius: 4px;
          color: white;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }

        .btn:hover {
          opacity: 0.9;
        }

        .main-btn {
          padding: 10px 20px;
          border-radius: 5px;
          font-weight: bold;
          font-size: 14px;
        }

        .blue { background: #007bff; }
        .green { background: #28a745; }
        .grey { background: #6c757d; }
        .orange { background: #ff9800; }

        .btn-edit { background: #6f42c1; }
        .btn-move { background: #007bff; }
        .btn-remove { background: #dc3545; }

        .status-active {
          background: #e2f5ea;
          color: #28a745;
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .status-removed {
          background: #f8d7da;
          color: #dc3545;
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        /* Desktop Action Buttons */
        .top-actions {
          display: flex;
          gap: 10px;
          margin: 20px 0;
          flex-wrap: wrap;
        }

        /* Desktop Table */
        .desktop-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .desktop-table th {
          text-align: left;
          border-bottom: 2px solid #eee;
          padding: 12px;
          color: #666;
          font-size: 14px;
          background: #f8f9fa;
        }

        .desktop-table td {
          padding: 12px;
          border-bottom: 1px solid #eee;
          font-size: 14px;
        }

        .desktop-table tr:hover {
          background: #f8f9fa;
        }

        .desktop-table td button {
          margin-right: 5px;
        }

        /* Hide mobile elements by default */
        .mobile-only {
          display: none;
        }

        /* Mobile Styles - Activate at 768px and below */
        @media screen and (max-width: 768px) {
          .desktop-table,
          .top-actions {
            display: none !important;
          }

          .mobile-only {
            display: block !important;
          }

          /* Mobile Button Grid (2x2) */
          .mobile-btn-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
          }

          .mobile-btn-grid .btn {
            width: 100%;
          }

          /* Registration Cards */
          .card {
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            background: #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }

          .card-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
            align-items: center;
          }

          .card-row:last-of-type {
            margin-bottom: 0;
          }

          .label {
            color: #888;
            font-weight: bold;
            font-size: 0.9em;
          }

          .card-actions {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 5px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
          }

          .card-actions .btn {
            width: 100%;
            padding: 8px 4px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  )
}
