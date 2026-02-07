'use client'

import { useEffect, useState } from 'react'
import { supabase, Order } from '@/lib/supabase'

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const ordersPerPage = 100

  // Fetch orders from Supabase
  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('date_created', { ascending: false })

    if (error) {
      console.error('Error fetching orders:', error)
    } else {
      setOrders(data || [])
      setFilteredOrders(data || [])
    }
    setLoading(false)
  }

  // Sync orders from WooCommerce
  const syncOrders = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-orders')
      const result = await response.json()
      
      if (result.success) {
        alert(`Successfully synced ${result.count} orders!`)
        fetchOrders()
      } else {
        alert('Failed to sync orders: ' + result.error)
      }
    } catch (error) {
      alert('Error syncing orders: ' + error)
    }
    setSyncing(false)
  }

  // Apply filters
  useEffect(() => {
    let filtered = [...orders]

    // Helper function to categorize product
    const getProductType = (order: Order): string => {
      if (!order.products || !Array.isArray(order.products)) return 'Other'
      
      const productNames = order.products.map((p: any) => p.name?.toLowerCase() || '').join(' ')
      
      // Check for Beginner Hockey
      if (productNames.includes('beginner hockey') || productNames.includes('pre-beginner')) {
        return 'Beginner Hockey'
      }
      
      // Check for Skills Development (fixed keywords)
      if (
        productNames.includes('powerskating') ||
        productNames.includes('power skating') ||
        productNames.includes('shooting & puck handling') ||
        productNames.includes('shooting and puck handling') ||
        productNames.includes('goalie camp')
      ) {
        return 'Skills Development'
      }
      
      // Everything else is Merchandise
      return 'Merchandise'
    }

    // Normalize product name helper (must match getCoursesByCategory logic)
    const normalizeProductName = (name: string): string => {
      return name
        .replace(/\s*-?\s*\d+\s*SPOTS?\s*LEFT/gi, '')
        .replace(/\s*-?\s*\d+%?\s*FULL/gi, '')
        .replace(/\s*-?\s*FULL\s*$/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Get all normalized product names from an order
    const getProductNames = (order: Order): string[] => {
      if (!order.products || !Array.isArray(order.products)) return []
      return order.products.map((p: any) => normalizeProductName(p.name || ''))
    }

    // Search filter (name, email, order number)
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.customer_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Course multi-select filter (using normalized names)
    if (selectedCourses.length > 0) {
      filtered = filtered.filter((order) => {
        const orderProducts = getProductNames(order)
        return orderProducts.some(product => selectedCourses.includes(product)))
      })
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(
        (order) => new Date(order.date_created) >= new Date(dateFrom)
      )
    }
    if (dateTo) {
      filtered = filtered.filter(
        (order) => new Date(order.date_created) <= new Date(dateTo)
      )
    }

    setFilteredOrders(filtered)
    setCurrentPage(1) // Reset to page 1 when filters change
  }, [searchTerm, statusFilter, selectedCourses, dateFrom, dateTo, orders])

  // Get paginated orders
  const indexOfLastOrder = currentPage * ordersPerPage
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder)
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage)

  // Get unique courses grouped by category
  const getCoursesByCategory = () => {
    const courseMap: { [key: string]: Set<string> } = {
      'Beginner Hockey': new Set(),
      'Skills Development': new Set(),
      'Merchandise': new Set(),
    }

    // Function to normalize product names (remove inventory indicators)
    const normalizeProductName = (name: string): string => {
      return name
        .replace(/\s*-?\s*\d+\s*SPOTS?\s*LEFT/gi, '') // Remove "10 SPOTS LEFT", "- 1 SPOT LEFT"
        .replace(/\s*-?\s*\d+%?\s*FULL/gi, '') // Remove "60% FULL", "FULL", "- FULL"
        .replace(/\s*-?\s*FULL\s*$/gi, '') // Remove trailing "FULL" or "- FULL"
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
    }

    orders.forEach((order) => {
      if (!order.products || !Array.isArray(order.products)) return
      
      order.products.forEach((product: any) => {
        const productName = product.name
        if (!productName) return

        const normalizedName = normalizeProductName(productName)
        const productLower = normalizedName.toLowerCase()
        
        if (productLower.includes('beginner hockey') || productLower.includes('pre-beginner')) {
          courseMap['Beginner Hockey'].add(normalizedName)
        } else if (
          productLower.includes('powerskating') ||
          productLower.includes('power skating') ||
          productLower.includes('shooting & puck handling') ||
          productLower.includes('shooting and puck handling') ||
          productLower.includes('goalie camp')
        ) {
          courseMap['Skills Development'].add(normalizedName)
        } else {
          courseMap['Merchandise'].add(normalizedName)
        }
      })
    })

    return {
      'Beginner Hockey': Array.from(courseMap['Beginner Hockey']).sort(),
      'Skills Development': Array.from(courseMap['Skills Development']).sort(),
      'Merchandise': Array.from(courseMap['Merchandise']).sort(),
    }
  }

  const coursesByCategory = getCoursesByCategory()

  // Toggle course selection
  const toggleCourse = (courseName: string) => {
    setSelectedCourses(prev =>
      prev.includes(courseName)
        ? prev.filter(c => c !== courseName)
        : [...prev, courseName]
    )
  }

  // Toggle all courses in a category
  const toggleCategory = (category: string) => {
    const categoryCourses = coursesByCategory[category as keyof typeof coursesByCategory]
    const allSelected = categoryCourses.every(course => selectedCourses.includes(course))
    
    if (allSelected) {
      // Deselect all in category
      setSelectedCourses(prev => prev.filter(c => !categoryCourses.includes(c)))
    } else {
      // Select all in category
      setSelectedCourses(prev => {
        const newSelection = [...prev]
        categoryCourses.forEach(course => {
          if (!newSelection.includes(course)) {
            newSelection.push(course)
          }
        })
        return newSelection
      })
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Get unique statuses for filter dropdown
  const statuses = Array.from(new Set(orders.map((o) => o.status)))

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          🏒 WooCommerce Order Tracker
        </h1>
        <p style={{ color: '#666' }}>Shinny of Champions Registration Management</p>
      </div>

      {/* Sync Button */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={syncOrders}
          disabled={syncing}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: syncing ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: '500',
          }}
        >
          {syncing ? 'Syncing...' : '🔄 Sync Orders from WooCommerce'}
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: '600' }}>
          Filters
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Name, email, order #"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
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
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        {/* Nested Course Filter */}
        <div style={{ marginTop: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '600', fontSize: '1.1rem' }}>
            Filter by Course
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(coursesByCategory).map(([category, courses]) => {
              if (courses.length === 0) return null
              const allSelected = courses.every(course => selectedCourses.includes(course))
              const someSelected = courses.some(course => selectedCourses.includes(course))
              
              return (
                <div key={category} style={{ 
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  padding: '1rem',
                  backgroundColor: '#fafafa'
                }}>
                  {/* Category Header */}
                  <div style={{ 
                    marginBottom: '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #e5e5e5'
                  }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '1rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected
                        }}
                        onChange={() => toggleCategory(category)}
                        style={{ 
                          marginRight: '0.5rem',
                          cursor: 'pointer',
                          width: '18px',
                          height: '18px'
                        }}
                      />
                      {category} ({courses.length})
                    </label>
                  </div>
                  
                  {/* Individual Courses */}
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '0.5rem',
                    paddingLeft: '1.5rem'
                  }}>
                    {courses.map(course => (
                      <label
                        key={course}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          fontSize: '0.9rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course)}
                          onChange={() => toggleCourse(course)}
                          style={{ 
                            marginRight: '0.5rem',
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px'
                          }}
                        />
                        <span style={{ flex: 1 }}>{course}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {(searchTerm || statusFilter || selectedCourses.length > 0 || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearchTerm('')
              setStatusFilter('')
              setSelectedCourses([])
              setDateFrom('')
              setDateTo('')
            }}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Orders Table */}
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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Orders</h2>
          <span style={{ color: '#666' }}>
            Showing {indexOfFirstOrder + 1}-{Math.min(indexOfLastOrder, filteredOrders.length)} of {filteredOrders.length} filtered orders
            {filteredOrders.length !== orders.length && ` (${orders.length} total)`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
            No orders found. Click "Sync Orders" to fetch from WooCommerce.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9f9f9' }}>
                <tr>
                  <th style={tableHeaderStyle}>Order #</th>
                  <th style={tableHeaderStyle}>Date</th>
                  <th style={tableHeaderStyle}>Customer</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Product(s)</th>
                  <th style={tableHeaderStyle}>Total</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {currentOrders.map((order) => (
                  <tr
                    key={order.id}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={tableCellStyle}>#{order.order_number}</td>
                    <td style={tableCellStyle}>
                      {new Date(order.date_created).toLocaleDateString()}
                    </td>
                    <td style={tableCellStyle}>
                      {order.customer_first_name} {order.customer_last_name}
                    </td>
                    <td style={tableCellStyle}>{order.customer_email}</td>
                    <td style={tableCellStyle}>
                      {order.products && Array.isArray(order.products) ? (
                        <div>
                          {order.products.map((product: any, idx: number) => (
                            <div key={idx} style={{ marginBottom: '0.25rem' }}>
                              {product.name} (×{product.quantity})
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={tableCellStyle}>${order.total}</td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          backgroundColor:
                            order.status === 'completed'
                              ? '#d4edda'
                              : order.status === 'processing'
                              ? '#fff3cd'
                              : order.status === 'pending'
                              ? '#f8d7da'
                              : '#e2e8f0',
                          color:
                            order.status === 'completed'
                              ? '#155724'
                              : order.status === 'processing'
                              ? '#856404'
                              : order.status === 'pending'
                              ? '#721c24'
                              : '#4a5568',
                        }}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{order.payment_method_title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredOrders.length > ordersPerPage && (
        <div style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === 1 ? '#e5e5e5' : '#0070f3',
              color: currentPage === 1 ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            ← Previous
          </button>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Show page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: currentPage === pageNum ? '#0070f3' : 'white',
                    color: currentPage === pageNum ? 'white' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: currentPage === pageNum ? '600' : '400'
                  }}
                >
                  {pageNum}
                </button>
              )
            })}
            
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span style={{ color: '#999' }}>...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'white',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: currentPage === totalPages ? '#e5e5e5' : '#0070f3',
              color: currentPage === totalPages ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            Next →
          </button>
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
