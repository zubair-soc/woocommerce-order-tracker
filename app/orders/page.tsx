'use client'

import { useEffect, useState } from 'react'
import { supabase, Order } from '@/lib/supabase'

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('')
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [programFilter, setProgramFilter] = useState<'active' | 'all'>('active')
  
  // UI state
  const [expandedCategories, setExpandedCategories] = useState<{[key: string]: boolean}>({})
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const ordersPerPage = 100

  // Installments modal state
  const [showInstallments, setShowInstallments] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>('')
  const [installments, setInstallments] = useState<any[]>([])
  const [installmentCounts, setInstallmentCounts] = useState<{[orderId: number]: {total: number, paid: number, totalDue: number, totalPaid: number}}>({})
  const [editingInstallment, setEditingInstallment] = useState<any | null>(null)
  const [installmentNumber, setInstallmentNumber] = useState('')
  const [amountDue, setAmountDue] = useState('')
  const [amountPaid, setAmountPaid] = useState('0')
  const [dueDate, setDueDate] = useState('')
  const [paidDate, setPaidDate] = useState('')
  const [installmentNotes, setInstallmentNotes] = useState('')

  // Fetch orders and products from Supabase
  const fetchOrders = async () => {
    setLoading(true)
    
    // Fetch orders - exclude drafts, pending, and failed orders
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .not('status', 'in', '("checkout-draft","pending","failed","cancelled")')
      .order('date_created', { ascending: false })

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
    } else {
      setOrders(ordersData || [])
      setFilteredOrders(ordersData || [])
    }

    // Fetch products
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')

    if (productsError) {
      console.error('Error fetching products:', productsError)
    } else {
      // Fetch program statuses to filter out completed programs
      const statusResponse = await fetch('/api/program-settings')
      const statusData = await statusResponse.json()
      
      let filteredProducts = productsData || []
      
      if (statusData.settings) {
        // Create a map of program statuses
        const statusMap: {[key: string]: string} = {}
        statusData.settings.forEach((s: any) => {
          statusMap[s.program_name] = s.status
        })
        
        // Only show products that are "open_registration" or don't have a status set
        filteredProducts = filteredProducts.filter((product: any) => {
          const status = statusMap[product.name]
          return !status || status === 'open_registration'
        })
      }
      
      setProducts(filteredProducts)
    }
    
    setLoading(false)
  }

  // Installments Functions
  const fetchInstallmentCounts = async (orderIds: number[]) => {
    const counts: {[orderId: number]: {total: number, paid: number, totalDue: number, totalPaid: number}} = {}
    
    for (const orderId of orderIds) {
      const response = await fetch(`/api/order-installments?order_id=${orderId}`)
      const data = await response.json()
      const installments = data.installments || []
      
      if (installments.length > 0) {
        const paid = installments.filter((i: any) => i.status === 'paid').length
        const totalDue = installments.reduce((sum: number, i: any) => sum + parseFloat(i.amount_due), 0)
        const totalPaid = installments.reduce((sum: number, i: any) => sum + parseFloat(i.amount_paid || '0'), 0)
        
        counts[orderId] = {
          total: installments.length,
          paid,
          totalDue,
          totalPaid
        }
      }
    }
    
    setInstallmentCounts(counts)
  }

  const fetchInstallments = async (orderId: number) => {
    const response = await fetch(`/api/order-installments?order_id=${orderId}`)
    const data = await response.json()
    setInstallments(data.installments || [])
  }

  const openInstallmentsModal = (order: any) => {
    setSelectedOrderId(order.order_id)
    setSelectedOrderNumber(order.order_number)
    fetchInstallments(order.order_id)
    setShowInstallments(true)
  }

  const saveInstallment = async () => {
    if (!installmentNumber || !amountDue) {
      alert('Installment number and amount due are required')
      return
    }

    await fetch('/api/order-installments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingInstallment?.id,
        order_id: selectedOrderId,
        installment_number: parseInt(installmentNumber),
        amount_due: amountDue,
        amount_paid: amountPaid,
        due_date: dueDate || null,
        paid_date: paidDate || null,
        status: paidDate ? 'paid' : 'pending',
        notes: installmentNotes
      })
    })

    setEditingInstallment(null)
    setInstallmentNumber('')
    setAmountDue('')
    setAmountPaid('0')
    setDueDate('')
    setPaidDate('')
    setInstallmentNotes('')

    if (selectedOrderId) {
      fetchInstallments(selectedOrderId)
      fetchInstallmentCounts([selectedOrderId])
    }
    alert('✅ Installment saved!')
  }

  const markInstallmentPaid = async (installment: any) => {
    const today = new Date().toISOString().split('T')[0]
    
    await fetch('/api/order-installments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...installment,
        amount_paid: installment.amount_due,
        paid_date: today,
        status: 'paid'
      })
    })

    if (selectedOrderId) {
      fetchInstallments(selectedOrderId)
      fetchInstallmentCounts([selectedOrderId])
    }
    alert('✅ Marked as paid!')
  }

  const deleteInstallment = async (id: number) => {
    if (!confirm('Delete this installment?')) return
    
    await fetch('/api/order-installments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })

    if (selectedOrderId) {
      fetchInstallments(selectedOrderId)
      fetchInstallmentCounts([selectedOrderId])
    }
    alert('✅ Deleted!')
  }

  const syncOrders = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-orders')
      const data = await response.json()
      
      if (data.success) {
        alert(`✅ Synced ${data.orderCount} orders with ${data.productCount} products`)
        fetchOrders()
      } else {
        alert('❌ Sync failed: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('❌ Sync failed')
    }
    setSyncing(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Apply filters
  useEffect(() => {
    let filtered = [...orders]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.customer_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number?.toString().includes(searchTerm)
      )
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    // Payment type filter
    if (paymentTypeFilter) {
      filtered = filtered.filter(order => order.payment_method_title === paymentTypeFilter)
    }

    // Course filter
    if (selectedCourses.length > 0) {
      filtered = filtered.filter(order => {
        if (!order.products || !Array.isArray(order.products)) return false
        return order.products.some((product: any) =>
          selectedCourses.includes(product.name)
        )
      })
    }

    // Date filter
    if (dateFrom) {
      filtered = filtered.filter(order =>
        new Date(order.date_created) >= new Date(dateFrom)
      )
    }
    if (dateTo) {
      filtered = filtered.filter(order =>
        new Date(order.date_created) <= new Date(dateTo)
      )
    }

    setFilteredOrders(filtered)
    setCurrentPage(1)
  }, [searchTerm, statusFilter, paymentTypeFilter, selectedCourses, dateFrom, dateTo, orders])

  // Date preset handler
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    switch (preset) {
      case 'all':
        setDateFrom('')
        setDateTo('')
        break
      case 'today':
        setDateFrom(today.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'yesterday':
        setDateFrom(yesterday.toISOString().split('T')[0])
        setDateTo(yesterday.toISOString().split('T')[0])
        break
      case 'last7':
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 7)
        setDateFrom(last7.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'last14':
        const last14 = new Date(today)
        last14.setDate(last14.getDate() - 14)
        setDateFrom(last14.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'last30':
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 30)
        setDateFrom(last30.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'thisMonth':
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
        setDateFrom(firstDay.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'lastMonth':
        const lastMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthLast = new Date(today.getFullYear(), today.getMonth(), 0)
        setDateFrom(lastMonthFirst.toISOString().split('T')[0])
        setDateTo(lastMonthLast.toISOString().split('T')[0])
        break
    }
  }

  // Group courses by category
  const groupCoursesByCategory = () => {
    const categories: {[key: string]: string[]} = {}
    
    products.forEach(product => {
      const name = product.name
      let category = 'Other'
      
      if (name.includes('Beginner Hockey')) category = 'Beginner Hockey'
      else if (name.includes('Skills Development')) category = 'Skills Development'
      else if (name.includes('Power Skating')) category = 'Power Skating'
      
      if (!categories[category]) categories[category] = []
      categories[category].push(name)
    })
    
    return categories
  }

  const toggleCategory = (category: string) => {
    const courses = groupCoursesByCategory()[category] || []
    const allSelected = courses.every(course => selectedCourses.includes(course))
    
    if (allSelected) {
      setSelectedCourses(selectedCourses.filter(c => !courses.includes(c)))
    } else {
      setSelectedCourses([...new Set([...selectedCourses, ...courses])])
    }
  }

  const toggleCourse = (course: string) => {
    if (selectedCourses.includes(course)) {
      setSelectedCourses(selectedCourses.filter(c => c !== course))
    } else {
      setSelectedCourses([...selectedCourses, course])
    }
  }

  // Pagination
  const indexOfLastOrder = currentPage * ordersPerPage
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder)
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage)

  const categorizedCourses = groupCoursesByCategory()

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '2rem' }}>📋</span>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: 0 }}>Orders</h1>
        </div>
        <p style={{ color: '#666', margin: 0 }}>WooCommerce order tracking and filtering</p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={syncOrders}
          disabled={syncing}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: syncing ? 0.6 : 1,
          }}
        >
          🔄 {syncing ? 'Syncing...' : 'Sync Orders from WooCommerce'}
        </button>
        <button
          onClick={() => window.location.href = '/programs'}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📚 Manage Programs
        </button>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: 0, marginBottom: '1rem' }}>Filters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Search</label>
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
                fontSize: '0.875rem',
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">All Statuses</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Payment Type</label>
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">All Payment Types</option>
              <option value="Card">Card</option>
              <option value="E-transfer">E-transfer</option>
              <option value="Link">Link</option>
              <option value="Google Pay">Google Pay</option>
              <option value="Apple Pay">Apple Pay</option>
            </select>
          </div>
        </div>

        {/* Date Range */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Date Range</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} className="date-buttons">
            {[
              { label: 'All', value: 'all' },
              { label: 'Today', value: 'today' },
              { label: 'Yesterday', value: 'yesterday' },
              { label: 'Last 7 Days', value: 'last7' },
              { label: 'Last 14 Days', value: 'last14' },
              { label: 'Last 30 Days', value: 'last30' },
              { label: 'This Month', value: 'thisMonth' },
              { label: 'Last Month', value: 'lastMonth' },
              { label: 'Custom', value: 'custom' },
            ].map(preset => (
              <button
                key={preset.value}
                onClick={() => handleDatePreset(preset.value)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  backgroundColor: datePreset === preset.value ? '#0070f3' : 'white',
                  color: datePreset === preset.value ? 'white' : '#333',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: datePreset === preset.value ? '600' : '400',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          {datePreset === 'custom' && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>From</label>
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
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>To</label>
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
          )}
        </div>

        {/* Filter by Course */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Filter by Course</h4>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={programFilter === 'active'}
                  onChange={() => setProgramFilter('active')}
                  style={{ cursor: 'pointer' }}
                />
                Active Programs Only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={programFilter === 'all'}
                  onChange={() => setProgramFilter('all')}
                  style={{ cursor: 'pointer' }}
                />
                All Programs (including completed)
              </label>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(categorizedCourses).map(([category, courses]) => {
              const isExpanded = expandedCategories[category]
              const allSelected = courses.every(course => selectedCourses.includes(course))
              const someSelected = courses.some(course => selectedCourses.includes(course)) && !allSelected
              
              return (
                <div key={category} style={{ border: '1px solid #e5e5e5', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      backgroundColor: '#fafafa',
                      cursor: 'pointer',
                    }}
                  >
                    <button
                      onClick={() => setExpandedCategories({ ...expandedCategories, [category]: !isExpanded })}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.2rem',
                        color: '#666'
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected
                      }}
                      onChange={() => toggleCategory(category)}
                      style={{ 
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px'
                      }}
                    />
                    
                    <span style={{ fontWeight: '600', fontSize: '1rem', flex: 1 }}>
                      {category}
                      <span style={{ fontWeight: '400', color: '#666', marginLeft: '0.5rem' }}>
                        ({courses.length} {courses.length === 1 ? 'course' : 'courses'})
                      </span>
                    </span>
                  </div>
                  
                  {isExpanded && (
                    <div style={{ 
                      padding: '1rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: '0.5rem',
                      backgroundColor: '#fafafa'
                    }}>
                      {courses.map(course => (
                        <label
                          key={course}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            fontSize: '0.9rem',
                            backgroundColor: 'white',
                            borderRadius: '4px',
                            border: '1px solid #e5e5e5'
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
                  )}
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
              setPaymentTypeFilter('')
              setSelectedCourses([])
              setDateFrom('')
              setDateTo('')
              setDatePreset('')
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

      {/* Orders Table - DESKTOP */}
      <div
        className="desktop-only"
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
                  <th style={tableHeaderStyle}>Unpaid</th>
                  <th style={tableHeaderStyle}>Installments</th>
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
                    <td style={tableCellStyle}>
                      <input
                        type="checkbox"
                        checked={order.payment_status === 'unpaid'}
                        onChange={async (e) => {
                          const newStatus = e.target.checked ? 'unpaid' : 'paid'
                          
                          await fetch('/api/orders', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              order_id: order.order_id,
                              payment_status: newStatus
                            })
                          })
                          
                          fetchOrders()
                        }}
                        style={{
                          cursor: 'pointer',
                          width: '18px',
                          height: '18px',
                          accentColor: '#dc2626',
                        }}
                        title={order.payment_status === 'unpaid' ? 'Mark as paid' : 'Mark as unpaid'}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      {order.has_installments ? (
                        <span
                          onClick={() => openInstallmentsModal(order)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.813rem',
                            cursor: 'pointer',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            fontWeight: '500',
                          }}
                        >
                          💰 Plan
                        </span>
                      ) : (
                        <span
                          onClick={() => openInstallmentsModal(order)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.813rem',
                            cursor: 'pointer',
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                          }}
                        >
                          + Add
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                backgroundColor: currentPage === 1 ? '#f5f5f5' : 'white',
              }}
            >
              Previous
            </button>
            <span style={{ padding: '0.5rem 1rem', color: '#666' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                backgroundColor: currentPage === totalPages ? '#f5f5f5' : 'white',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Orders Cards - MOBILE */}
      <div className="mobile-only">
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>
            Showing {filteredOrders.length} orders
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '8px' }}>Loading...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#666', background: 'white', borderRadius: '8px' }}>
            No orders found.
          </div>
        ) : (
          currentOrders.map((order) => (
            <div
              key={order.id}
              className="order-card"
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                border: '1px solid #eee',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                    {order.customer_first_name} {order.customer_last_name}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.85em', marginTop: '0.25rem' }}>
                    #{order.order_number} • {new Date(order.date_created).toLocaleDateString()}
                  </div>
                </div>
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor:
                      order.status === 'completed'
                        ? '#d4edda'
                        : order.status === 'processing'
                        ? '#fff3cd'
                        : '#f8d7da',
                    color:
                      order.status === 'completed'
                        ? '#155724'
                        : order.status === 'processing'
                        ? '#856404'
                        : '#721c24',
                  }}
                >
                  {order.status}
                </span>
              </div>

              <div
                style={{
                  background: '#f8f9fa',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.85em',
                  margin: '0.75rem 0',
                  borderLeft: '3px solid #007bff',
                }}
              >
                {order.products && Array.isArray(order.products) ? (
                  order.products.map((product: any, idx: number) => (
                    <div key={idx}>
                      {product.name} (×{product.quantity})
                    </div>
                  ))
                ) : (
                  '-'
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #eee',
                }}
              >
                <div style={{ color: '#666', fontSize: '0.85em' }}>
                  Payment: <strong>{order.payment_method_title}</strong>
                </div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#10b981' }}>
                  ${order.total}
                </div>
              </div>

              {order.has_installments && (
                <button
                  onClick={() => openInstallmentsModal(order)}
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    padding: '0.5rem',
                    background: '#fef3c7',
                    color: '#92400e',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                  }}
                >
                  💰 View Payment Plan
                </button>
              )}
            </div>
          ))
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                backgroundColor: currentPage === 1 ? '#f5f5f5' : 'white',
                fontWeight: '600',
              }}
            >
              ← Prev
            </button>
            <span style={{ padding: '0.75rem 1rem', color: '#666', display: 'flex', alignItems: 'center' }}>
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                backgroundColor: currentPage === totalPages ? '#f5f5f5' : 'white',
                fontWeight: '600',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Installments Modal */}
      {showInstallments && (
        <div
          onClick={() => setShowInstallments(false)}
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
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                Payment Plan - Order #{selectedOrderNumber}
              </h2>
              <button
                onClick={() => setShowInstallments(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Add Installment Button */}
            {!editingInstallment && (
              <button
                onClick={() => {
                  setEditingInstallment({})
                  setInstallmentNumber(String(installments.length + 1))
                  setAmountDue('')
                  setAmountPaid('0')
                  setDueDate('')
                  setPaidDate('')
                  setInstallmentNotes('')
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  marginBottom: '1.5rem',
                }}
              >
                + Add Installment
              </button>
            )}

            {/* Add/Edit Form */}
            {editingInstallment && (
              <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
                  {editingInstallment.id ? 'Edit Installment' : 'New Installment'}
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Installment #
                    </label>
                    <input
                      type="number"
                      value={installmentNumber}
                      onChange={(e) => setInstallmentNumber(e.target.value)}
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
                      Amount Due
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountDue}
                      onChange={(e) => setAmountDue(e.target.value)}
                      placeholder="200.00"
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
                      Amount Paid
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="0.00"
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
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
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
                      Paid Date
                    </label>
                    <input
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
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
                      Notes
                    </label>
                    <input
                      type="text"
                      value={installmentNotes}
                      onChange={(e) => setInstallmentNotes(e.target.value)}
                      placeholder="Second of 3 payments"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setEditingInstallment(null)
                      setInstallmentNumber('')
                      setAmountDue('')
                      setAmountPaid('0')
                      setDueDate('')
                      setPaidDate('')
                      setInstallmentNotes('')
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
                    onClick={saveInstallment}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Installments List */}
            {installments.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                No installments yet. Click "Add Installment" to create one.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {installments.map((inst) => {
                  const isPaid = inst.status === 'paid'
                  const isOverdue = !isPaid && inst.due_date && new Date(inst.due_date) < new Date()
                  
                  return (
                    <div
                      key={inst.id}
                      style={{
                        padding: '1rem',
                        border: `2px solid ${isPaid ? '#10b981' : isOverdue ? '#ef4444' : '#e5e7eb'}`,
                        borderRadius: '6px',
                        backgroundColor: isPaid ? '#f0fdf4' : isOverdue ? '#fef2f2' : '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                            Installment #{inst.installment_number}
                            <span style={{
                              marginLeft: '1rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                              backgroundColor: isPaid ? '#10b981' : isOverdue ? '#ef4444' : '#f59e0b',
                              color: 'white',
                            }}>
                              {isPaid ? '✓ Paid' : isOverdue ? 'Overdue' : 'Pending'}
                            </span>
                          </div>
                          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                            <div>Amount Due: <strong>${inst.amount_due}</strong></div>
                            <div>Amount Paid: <strong>${inst.amount_paid || '0'}</strong></div>
                            {inst.due_date && (
                              <div>Due: {new Date(inst.due_date).toLocaleDateString()}</div>
                            )}
                            {inst.paid_date && (
                              <div>Paid: {new Date(inst.paid_date).toLocaleDateString()}</div>
                            )}
                            {inst.notes && (
                              <div style={{ marginTop: '0.5rem' }}>Note: {inst.notes}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {!isPaid && (
                            <button
                              onClick={() => markInstallmentPaid(inst)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                              }}
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingInstallment(inst)
                              setInstallmentNumber(String(inst.installment_number))
                              setAmountDue(inst.amount_due)
                              setAmountPaid(inst.amount_paid || '0')
                              setDueDate(inst.due_date || '')
                              setPaidDate(inst.paid_date || '')
                              setInstallmentNotes(inst.notes || '')
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteInstallment(inst.id)}
                            style={{
                              padding: '0.5rem 1rem',
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
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile-Responsive CSS */}
      <style jsx>{`
        .desktop-only {
          display: block;
        }
        .mobile-only {
          display: none;
        }

        @media screen and (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }
          .mobile-only {
            display: block !important;
          }

          /* Make date buttons scrollable on mobile */
          .date-buttons {
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
          }

          .date-buttons button {
            flex-shrink: 0;
          }
        }
      `}</style>
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
