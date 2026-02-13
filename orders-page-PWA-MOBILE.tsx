'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Order = {
  id: number
  order_id: string
  order_date: string
  customer_name: string
  customer_email: string
  order_total: string
  order_status: string
  payment_method: string
  products: string
  payment_status?: string
  has_installments?: boolean
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [programFilter, setProgramFilter] = useState<string>('active')
  
  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false })
    
    if (error) {
      console.error('Error fetching orders:', error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  async function syncOrders() {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-orders', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      const result = await response.json()
      if (result.success) {
        alert(`Synced ${result.orderCount} orders with ${result.productCount} products`)
        fetchOrders()
      }
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed')
    }
    setSyncing(false)
  }

  const filteredOrders = orders.filter(order => {
    // Date filter
    if (dateFilter !== 'all') {
      const orderDate = new Date(order.order_date)
      const today = new Date()
      const diffDays = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (dateFilter === 'today' && diffDays !== 0) return false
      if (dateFilter === 'yesterday' && diffDays !== 1) return false
      if (dateFilter === '7days' && diffDays > 7) return false
      if (dateFilter === '14days' && diffDays > 14) return false
      if (dateFilter === '30days' && diffDays > 30) return false
    }

    // Payment filter
    if (paymentFilter !== 'all' && order.payment_method !== paymentFilter) {
      return false
    }

    return true
  })

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: 'auto', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/" style={{ color: '#007bff', textDecoration: 'none', fontSize: '14px' }}>← Back to Home</Link>
      </div>

      <h1 style={{ marginBottom: '10px' }}>Orders</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        {filteredOrders.length} orders {dateFilter !== 'all' && `(filtered)`}
      </p>

      {/* Sync Button */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={syncOrders}
          disabled={syncing}
          style={{
            padding: '10px 20px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {syncing ? 'Syncing...' : '🔄 Sync Orders'}
        </button>
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <h3 style={{ marginTop: 0 }}>Date Range</h3>
        <div className="date-buttons">
          <button className={dateFilter === 'all' ? 'btn-blue' : ''} onClick={() => setDateFilter('all')}>All</button>
          <button className={dateFilter === 'today' ? 'btn-blue' : ''} onClick={() => setDateFilter('today')}>Today</button>
          <button className={dateFilter === 'yesterday' ? 'btn-blue' : ''} onClick={() => setDateFilter('yesterday')}>Yesterday</button>
          <button className={dateFilter === '7days' ? 'btn-blue' : ''} onClick={() => setDateFilter('7days')}>Last 7 Days</button>
          <button className="desktop-only" style={{ display: dateFilter === '14days' ? 'inline-block' : undefined }} onClick={() => setDateFilter('14days')}>Last 14 Days</button>
          <button className="desktop-only" style={{ display: dateFilter === '30days' ? 'inline-block' : undefined }} onClick={() => setDateFilter('30days')}>Last 30 Days</button>
        </div>

        <div className="desktop-only">
          <h3 style={{ marginTop: '20px' }}>Payment Method</h3>
          <select 
            value={paymentFilter} 
            onChange={(e) => setPaymentFilter(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="all">All Payment Types</option>
            <option value="Card">Credit Card</option>
            <option value="E-transfer">E-transfer</option>
            <option value="Link">Payment Link</option>
            <option value="Google Pay">Google Pay</option>
            <option value="Apple Pay">Apple Pay</option>
          </select>

          <h3 style={{ marginTop: '20px' }}>Filter by Course</h3>
          <label>
            <input type="radio" checked={programFilter === 'active'} onChange={() => setProgramFilter('active')} />
            Active Programs Only
          </label>
        </div>
      </div>

      {/* Desktop Table */}
      <table className="order-table desktop-only">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Product(s)</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map(order => (
            <tr key={order.id}>
              <td>{order.order_id}</td>
              <td>{new Date(order.order_date).toLocaleDateString()}</td>
              <td>{order.customer_name}</td>
              <td style={{ fontSize: '13px' }}>{order.products}</td>
              <td style={{ fontWeight: 'bold', color: '#28a745' }}>{order.order_total}</td>
              <td>{order.payment_method}</td>
              <td>
                <span className="badge">{order.order_status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Cards */}
      <div className="mobile-only">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>Showing {filteredOrders.length} orders</span>
          <button style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer' }}>
            Filter ⚙️
          </button>
        </div>

        {filteredOrders.map(order => (
          <div key={order.id} className="order-card">
            <div className="card-header">
              <div>
                <div className="customer-info">{order.customer_name}</div>
                <div className="order-meta">
                  {order.order_id} • {new Date(order.order_date).toLocaleDateString()}
                </div>
              </div>
              <span className="badge">{order.order_status}</span>
            </div>

            <div className="product-box">{order.products}</div>

            <div className="card-footer">
              <div className="order-meta">
                Payment: <strong>{order.payment_method}</strong>
              </div>
              <div className="price">{order.order_total}</div>
            </div>
          </div>
        ))}
      </div>

      {loading && <p>Loading orders...</p>}

      <style jsx>{`
        /* Shared Styles */
        .filter-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .date-buttons {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .date-buttons button {
          padding: 8px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .date-buttons button:hover {
          background: #f8f9fa;
        }

        .btn-blue {
          background: #007bff !important;
          color: white !important;
          border: none !important;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          background: #fff3cd;
          color: #856404;
          white-space: nowrap;
        }

        /* Desktop Table Styles */
        .order-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .order-table th {
          text-align: left;
          padding: 12px;
          border-bottom: 2px solid #eee;
          font-size: 13px;
          color: #666;
          background: #f8f9fa;
        }

        .order-table td {
          padding: 12px;
          border-bottom: 1px solid #eee;
          font-size: 14px;
        }

        .order-table tr:hover {
          background: #f8f9fa;
        }

        /* Desktop-only elements */
        .desktop-only {
          display: block;
        }

        .mobile-only {
          display: none;
        }

        /* Mobile Styles - Activate at 768px and below */
        @media screen and (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }

          .mobile-only {
            display: block !important;
          }

          /* Scrollable Date Buttons on Mobile */
          .date-buttons {
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 10px;
            -webkit-overflow-scrolling: touch;
          }

          .date-buttons button {
            flex-shrink: 0;
          }

          /* Order Cards */
          .order-card {
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            border: 1px solid #eee;
          }

          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10px;
          }

          .customer-info {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 4px;
          }

          .order-meta {
            color: #666;
            font-size: 0.85em;
          }

          .product-box {
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            font-size: 0.85em;
            margin: 10px 0;
            border-left: 3px solid #007bff;
          }

          .card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
          }

          .price {
            font-size: 1.2em;
            font-weight: bold;
            color: #28a745;
          }
        }
      `}</style>
    </div>
  )
}
