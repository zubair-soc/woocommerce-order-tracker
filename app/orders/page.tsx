'use client'

import { useEffect, useState } from 'react'
import { supabase, Order } from '@/lib/supabase'

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [ordersWithTransfers, setOrdersWithTransfers] = useState<Set<number>>(new Set())
  const [transferDestinations, setTransferDestinations] = useState<{[orderId: number]: string[]}>({})
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('')
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [programFilter, setProgramFilter] = useState<'active' | 'all'>('active')
  const [showTransfersOnly, setShowTransfersOnly] = useState(false)
  
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
    
    // Fetch which orders have transfers (registrations with source='transfer')
    if (ordersData && ordersData.length > 0) {
      const { data: transferredRegs, error: transferError } = await supabase
        .from('program_registrations')
        .select('order_id, program_name')
        .eq('source', 'transfer')
        .in('order_id', ordersData.map(o => o.order_id))
      
      if (!transferError && transferredRegs) {
        const transferredOrderIds = new Set(transferredRegs.map(r => r.order_id))
        setOrdersWithTransfers(transferredOrderIds)
        
        // Build map of order_id -> list of program names they transferred to
        const destinations: {[orderId: number]: string[]} = {}
        transferredRegs.forEach(reg => {
          if (!destinations[reg.order_id]) {
            destinations[reg.order_id] = []
          }
          if (!destinations[reg.order_id].includes(reg.program_name)) {
            destinations[reg.order_id].push(reg.program_name)
          }
        })
        setTransferDestinations(destinations)
      }
    }
    
    setLoading(false)
    
    // Fetch installment counts for all orders
    // TEMPORARILY DISABLED - This was causing slowness
    // if (ordersData && ordersData.length > 0) {
    //   const orderIds = ordersData.map(o => o.order_id)
    //   fetchInstallmentCounts(orderIds)
    // }
  }

  // Installments Functions
  const fetchInstallmentCounts = async (orderIds: number[]) => {
    // Fetch installments for all orders
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

    // Clear form
    setEditingInstallment(null)
    setInstallmentNumber('')
    setAmountDue('')
    setAmountPaid('0')
    setDueDate('')
    setPaidDate('')
    setInstallmentNotes('')

    // Refresh list
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
    
    await fetch(`/api/order-installments?id=${id}`, { method: 'DELETE' })
    if (selectedOrderId) {
      fetchInstallments(selectedOrderId)
      fetchInstallmentCounts([selectedOrderId])
    }
    alert('✅ Installment deleted')
  }

  // Sync orders from WooCommerce
  const syncOrders = async () => {
    setSyncing(true)
    try {
      // Add timestamp to bust cache
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/sync-orders?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
      const result = await response.json()
      
      if (result.success) {
        alert(`Successfully synced ${result.orderCount} orders!`)
        // Force a complete refresh of orders data
        await fetchOrders()
      } else {
        alert('Failed to sync orders: ' + result.error)
      }
    } catch (error) {
      alert('Error syncing orders: ' + error)
    }
    setSyncing(false)
  }

  // Debug sync status
  const checkSyncStatus = async () => {
    try {
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/debug-sync?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
      const result = await response.json()
      setDebugInfo(result)
      setShowDebug(true)
    } catch (error) {
      alert('Error checking sync status: ' + error)
    }
  }

  // Handle date preset selection
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    switch(preset) {
      case 'today':
        setDateFrom(today.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'yesterday':
        setDateFrom(yesterday.toISOString().split('T')[0])
        setDateTo(yesterday.toISOString().split('T')[0])
        break
      case 'last7':
        const week = new Date(today)
        week.setDate(week.getDate() - 7)
        setDateFrom(week.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'last14':
        const twoWeeks = new Date(today)
        twoWeeks.setDate(twoWeeks.getDate() - 14)
        setDateFrom(twoWeeks.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'last30':
        const month = new Date(today)
        month.setDate(month.getDate() - 30)
        setDateFrom(month.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'thisMonth':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        setDateFrom(monthStart.toISOString().split('T')[0])
        setDateTo(today.toISOString().split('T')[0])
        break
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        setDateFrom(lastMonthStart.toISOString().split('T')[0])
        setDateTo(lastMonthEnd.toISOString().split('T')[0])
        break
      case 'custom':
        // User will set dates manually
        break
    }
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

    // Payment type filter
    if (paymentTypeFilter) {
      filtered = filtered.filter((order) => order.payment_method_title === paymentTypeFilter)
    }

    // Course multi-select filter (using normalized names)
    if (selectedCourses.length > 0) {
      filtered = filtered.filter((order) => {
        const orderProducts = getProductNames(order)
        return orderProducts.some(product => selectedCourses.includes(product))
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

    // Transfer filter - show only orders with transfers
    if (showTransfersOnly) {
      filtered = filtered.filter((order) => ordersWithTransfers.has(order.order_id))
    }

    setFilteredOrders(filtered)
    setCurrentPage(1) // Reset to page 1 when filters change
  }, [searchTerm, statusFilter, paymentTypeFilter, selectedCourses, dateFrom, dateTo, orders, showTransfersOnly, ordersWithTransfers])

  // Get paginated orders
  const indexOfLastOrder = currentPage * ordersPerPage
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder)
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage)

  // Get unique courses grouped by category with active/total counts
  const getCoursesByCategory = () => {
    const courseMap: { [key: string]: { allCourses: Set<string>, activeCourses: Set<string> } } = {
      'Beginner Hockey': { allCourses: new Set(), activeCourses: new Set() },
      'Skills Development': { allCourses: new Set(), activeCourses: new Set() },
      'Merchandise': { allCourses: new Set(), activeCourses: new Set() },
    }

    // Function to normalize product names (remove inventory indicators)
    const normalizeProductName = (name: string): string => {
      return name
        .replace(/\s*-?\s*\d+\s*SPOTS?\s*LEFT/gi, '')
        .replace(/\s*-?\s*\d+%?\s*FULL/gi, '')
        .replace(/\s*-?\s*FULL\s*$/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Check if a product is active (published)
    const isProductActive = (productName: string): boolean => {
      const product = products.find(p => normalizeProductName(p.name) === productName)
      return product ? product.status === 'publish' : false
    }

    orders.forEach((order) => {
      if (!order.products || !Array.isArray(order.products)) return
      
      order.products.forEach((product: any) => {
        const productName = product.name
        if (!productName) return

        const normalizedName = normalizeProductName(productName)
        const productLower = normalizedName.toLowerCase()
        const isActive = isProductActive(normalizedName)
        
        if (productLower.includes('beginner hockey') || productLower.includes('pre-beginner')) {
          courseMap['Beginner Hockey'].allCourses.add(normalizedName)
          if (isActive) courseMap['Beginner Hockey'].activeCourses.add(normalizedName)
        } else if (
          productLower.includes('powerskating') ||
          productLower.includes('power skating') ||
          productLower.includes('shooting & puck handling') ||
          productLower.includes('shooting and puck handling') ||
          productLower.includes('goalie camp')
        ) {
          courseMap['Skills Development'].allCourses.add(normalizedName)
          if (isActive) courseMap['Skills Development'].activeCourses.add(normalizedName)
        } else {
          courseMap['Merchandise'].allCourses.add(normalizedName)
          if (isActive) courseMap['Merchandise'].activeCourses.add(normalizedName)
        }
      })
    })

    // Return courses based on filter selection
    const getCoursesForCategory = (category: keyof typeof courseMap) => {
      if (programFilter === 'active') {
        return Array.from(courseMap[category].activeCourses).sort()
      }
      return Array.from(courseMap[category].allCourses).sort()
    }

    return {
      'Beginner Hockey': {
        courses: getCoursesForCategory('Beginner Hockey'),
        activeCount: courseMap['Beginner Hockey'].activeCourses.size,
        totalCount: courseMap['Beginner Hockey'].allCourses.size,
      },
      'Skills Development': {
        courses: getCoursesForCategory('Skills Development'),
        activeCount: courseMap['Skills Development'].activeCourses.size,
        totalCount: courseMap['Skills Development'].allCourses.size,
      },
      'Merchandise': {
        courses: getCoursesForCategory('Merchandise'),
        activeCount: courseMap['Merchandise'].activeCourses.size,
        totalCount: courseMap['Merchandise'].allCourses.size,
      },
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
    const categoryData = coursesByCategory[category as keyof typeof coursesByCategory]
    const categoryCourses = categoryData.courses
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

  // Toggle category expansion
  const toggleExpand = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  useEffect(() => {
    fetchOrders()
    
    // Check if mobile on mount
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    
    // Listen for resize
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Get unique statuses for filter dropdown
  const statuses = Array.from(new Set(orders.map((o) => o.status)))
  const paymentTypes = Array.from(new Set(orders.map((o) => o.payment_method_title).filter(Boolean)))

  return (
    <div style={{ 
      padding: '1rem', // Mobile padding
      maxWidth: '1400px', 
      margin: '0 auto' 
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          📦 Orders
        </h1>
        <p style={{ color: '#666', fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>WooCommerce order tracking and filtering</p>
      </div>

      {/* Sync Button and Navigation */}
      <div style={{ 
        marginBottom: '2rem', 
        display: 'flex', 
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
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
            flex: '1 1 auto',
          }}
        >
          {syncing ? 'Syncing...' : '🔄 Sync Orders'}
        </button>

        <button
          onClick={checkSyncStatus}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: 'pointer',
            fontWeight: '500',
            flex: '1 1 auto',
          }}
        >
          🔍 Sync Status
        </button>

        <a
          href="/credits"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            textDecoration: 'none',
            fontWeight: '500',
            display: 'inline-block',
            textAlign: 'center',
            flex: '1 1 auto',
          }}
        >
          💰 Credits
        </a>

        <a
          href="/programs"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            textDecoration: 'none',
            fontWeight: '500',
            display: 'inline-block',
            textAlign: 'center',
            flex: '1 1 auto',
          }}
        >
          📋 Programs
        </a>
      </div>

      {/* Debug Info Panel */}
      {showDebug && debugInfo && (
        <div
          style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: debugInfo.comparison?.allInSync ? '2px solid #10b981' : '2px solid #ef4444',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
              🔍 Sync Status Debug Info
            </h2>
            <button
              onClick={() => setShowDebug(false)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', // Responsive grid
            gap: '1.5rem' 
          }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0070f3' }}>
                WooCommerce (Latest 5)
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                <p><strong>Count:</strong> {debugInfo.wooCommerce.count}</p>
                <p><strong>Latest Order ID:</strong> {debugInfo.wooCommerce.latestOrderId}</p>
                <p><strong>Latest Order #:</strong> {debugInfo.wooCommerce.latestOrderNumber}</p>
                <p><strong>Latest Date:</strong> {new Date(debugInfo.wooCommerce.latestOrderDate).toLocaleString()}</p>
                <p><strong>Latest Status:</strong> {debugInfo.wooCommerce.latestOrderStatus}</p>
                <p><strong>Order IDs:</strong> {debugInfo.wooCommerce.orderIds.join(', ')}</p>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#10b981' }}>
                Database (Latest 5)
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                <p><strong>Count:</strong> {debugInfo.supabase.count}</p>
                <p><strong>Latest Order ID:</strong> {debugInfo.supabase.latestOrderId}</p>
                <p><strong>Latest Order #:</strong> {debugInfo.supabase.latestOrderNumber}</p>
                <p><strong>Latest Date:</strong> {debugInfo.supabase.latestOrderDate ? new Date(debugInfo.supabase.latestOrderDate).toLocaleString() : 'N/A'}</p>
                <p><strong>Order IDs:</strong> {debugInfo.supabase.orderIds.join(', ')}</p>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: debugInfo.comparison?.allInSync ? '#f0fdf4' : '#fef2f2',
              borderRadius: '6px',
              border: debugInfo.comparison?.allInSync ? '1px solid #10b981' : '1px solid #ef4444',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              {debugInfo.comparison?.allInSync ? '✅ All In Sync!' : '❌ Sync Issue Detected'}
            </h3>
            {!debugInfo.comparison?.allInSync && (
              <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                <p><strong>Missing in Database:</strong> Order IDs: {debugInfo.comparison.missingInSupabase.join(', ')}</p>
                <p style={{ marginTop: '0.5rem', color: '#dc2626', fontWeight: '500' }}>
                  ⚠️ Click "Sync Orders from WooCommerce" to fix this issue
                </p>
              </div>
            )}
          </div>

          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>
            Last checked: {new Date(debugInfo.timestamp).toLocaleString()}
          </div>
        </div>
      )}

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

          {/* Payment Type Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Payment Type
            </label>
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="">All Payment Types</option>
              {paymentTypes.sort().map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Has Transfers Filter */}
          <div>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              cursor: 'pointer',
              padding: '0.5rem 0',
              fontWeight: '500'
            }}>
              <input
                type="checkbox"
                checked={showTransfersOnly}
                onChange={(e) => setShowTransfersOnly(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#f59e0b',
                }}
              />
              <span>Has Transfers</span>
              {ordersWithTransfers.size > 0 && (
                <span style={{
                  fontSize: '0.875rem',
                  color: '#f59e0b',
                  backgroundColor: '#fef3c7',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '12px',
                  fontWeight: '600',
                }}>
                  {ordersWithTransfers.size}
                </span>
              )}
            </label>
          </div>

          {/* Date Presets */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Date Range
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                onClick={() => {
                  setDatePreset('')
                  setDateFrom('')
                  setDateTo('')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: !datePreset ? '#0070f3' : 'white',
                  color: !datePreset ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: !datePreset ? '600' : '400',
                }}
              >
                All
              </button>
              <button
                onClick={() => handleDatePreset('today')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'today' ? '#0070f3' : 'white',
                  color: datePreset === 'today' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Today
              </button>
              <button
                onClick={() => handleDatePreset('yesterday')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'yesterday' ? '#0070f3' : 'white',
                  color: datePreset === 'yesterday' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Yesterday
              </button>
              <button
                onClick={() => handleDatePreset('last7')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'last7' ? '#0070f3' : 'white',
                  color: datePreset === 'last7' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handleDatePreset('last14')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'last14' ? '#0070f3' : 'white',
                  color: datePreset === 'last14' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Last 14 Days
              </button>
              <button
                onClick={() => handleDatePreset('last30')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'last30' ? '#0070f3' : 'white',
                  color: datePreset === 'last30' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => handleDatePreset('thisMonth')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'thisMonth' ? '#0070f3' : 'white',
                  color: datePreset === 'thisMonth' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                This Month
              </button>
              <button
                onClick={() => handleDatePreset('lastMonth')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'lastMonth' ? '#0070f3' : 'white',
                  color: datePreset === 'lastMonth' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Last Month
              </button>
              <button
                onClick={() => { handleDatePreset('custom'); }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: datePreset === 'custom' ? '#0070f3' : 'white',
                  color: datePreset === 'custom' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Custom
              </button>
            </div>

            {/* Show custom date inputs only when Custom is selected */}
            {datePreset === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
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
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
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
            )}
          </div>
        </div>

        {/* Nested Course Filter */}
        <div style={{ marginTop: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '600', fontSize: '1.1rem' }}>
            Filter by Course
          </label>
          
          {/* Active/All Programs Radio Buttons */}
          <div style={{ 
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            border: '1px solid #bfdbfe'
          }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
                <input
                  type="radio"
                  name="programFilter"
                  checked={programFilter === 'active'}
                  onChange={() => setProgramFilter('active')}
                  style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                />
                Active Programs Only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: '500' }}>
                <input
                  type="radio"
                  name="programFilter"
                  checked={programFilter === 'all'}
                  onChange={() => setProgramFilter('all')}
                  style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                />
                All Programs (including completed)
              </label>
            </div>
          </div>

          {/* Collapsible Categories */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(coursesByCategory).map(([category, categoryData]) => {
              const { courses, activeCount, totalCount } = categoryData
              if (courses.length === 0) return null
              
              const isExpanded = expandedCategories[category]
              const allSelected = courses.every(course => selectedCourses.includes(course))
              const someSelected = courses.some(course => selectedCourses.includes(course))
              
              return (
                <div key={category} style={{ 
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  overflow: 'hidden'
                }}>
                  {/* Category Header - Always Visible */}
                  <div style={{ 
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    backgroundColor: isExpanded ? '#f9fafb' : 'white',
                    borderBottom: isExpanded ? '1px solid #e5e5e5' : 'none'
                  }}>
                    {/* Expand/Collapse Arrow */}
                    <button
                      onClick={() => toggleExpand(category)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.2rem',
                        color: '#666'
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    
                    {/* Category Checkbox */}
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
                    
                    {/* Category Name and Count */}
                    <span style={{ fontWeight: '600', fontSize: '1rem', flex: 1 }}>
                      {category}
                      <span style={{ fontWeight: '400', color: '#666', marginLeft: '0.5rem' }}>
                        ({programFilter === 'active' ? `${activeCount} active` : `${activeCount} active, ${totalCount} total`})
                      </span>
                    </span>
                  </div>
                  
                  {/* Individual Courses - Shown when expanded */}
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
        ) : isMobile ? (
          // Mobile Card View
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {currentOrders.map((order) => (
              <div
                key={order.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                {/* Header: Name and Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                    {order.customer_first_name} {order.customer_last_name}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    backgroundColor: order.status === 'completed' ? '#dcfce7' : '#fef3c7',
                    color: order.status === 'completed' ? '#166534' : '#92400e',
                  }}>
                    {order.status}
                  </span>
                </div>

                {/* Order number and date */}
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>#{order.order_number} • {new Date(order.date_created).toLocaleDateString()}</span>
                  {ordersWithTransfers.has(order.order_id) && transferDestinations[order.order_id] && (
                    <span 
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '12px',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        fontWeight: '600',
                        cursor: 'help',
                      }}
                      title={`Transferred to: ${transferDestinations[order.order_id].join(', ')}`}
                    >
                      🔄 Transferred to {transferDestinations[order.order_id].length} program{transferDestinations[order.order_id].length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Products */}
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderLeft: '4px solid #3b82f6',
                  borderRadius: '4px',
                  marginBottom: '0.75rem'
                }}>
                  {order.products && Array.isArray(order.products) && order.products.map((product: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '0.875rem', marginBottom: idx < order.products.length - 1 ? '0.25rem' : 0 }}>
                      {product.name} {product.quantity > 1 ? `(×${product.quantity})` : ''}
                    </div>
                  ))}
                </div>

                {/* Payment info and Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    Payment: <strong>{order.payment_method_title || order.payment_method}</strong>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                    ${order.total}
                  </div>
                </div>

                {/* Action buttons: Unpaid checkbox and Installments */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  {/* Unpaid checkbox */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}>
                    <input
                      type="checkbox"
                      checked={order.payment_status === 'unpaid'}
                      onChange={async (e) => {
                        const newStatus = e.target.checked ? 'unpaid' : 'paid'
                        
                        // Update via API
                        await fetch('/api/orders', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            order_id: order.order_id,
                            payment_status: newStatus,
                          }),
                        })
                        
                        // Update local state
                        setOrders(orders.map(o => 
                          o.order_id === order.order_id 
                            ? { ...o, payment_status: newStatus } 
                            : o
                        ))
                        setFilteredOrders(filteredOrders.map(o => 
                          o.order_id === order.order_id 
                            ? { ...o, payment_status: newStatus } 
                            : o
                        ))
                      }}
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: '#dc2626',
                      }}
                    />
                    <span style={{ color: '#6b7280' }}>Unpaid</span>
                  </label>

                  {/* Installments button */}
                  <div>
                    {order.has_installments ? (
                      <button
                        onClick={() => openInstallmentsModal(order)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          fontWeight: '500',
                          border: 'none',
                        }}
                      >
                        💰 Payment Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => openInstallmentsModal(order)}
                        style={{
                          color: '#3b82f6',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          backgroundColor: 'transparent',
                          border: 'none',
                          padding: '0.5rem 1rem',
                        }}
                      >
                        + Add Installments
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop Table View
          <div style={{ 
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              minWidth: '800px', // Ensure table doesn't compress too much
            }}>
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
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>#{order.order_number}</span>
                        {ordersWithTransfers.has(order.order_id) && transferDestinations[order.order_id] && (
                          <span 
                            style={{
                              fontSize: '0.875rem',
                              cursor: 'help',
                            }}
                            title={`Transferred to: ${transferDestinations[order.order_id].join(', ')}`}
                          >
                            🔄
                          </span>
                        )}
                      </div>
                    </td>
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
                          
                          // Update via API
                          await fetch('/api/orders', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              order_id: order.order_id,
                              payment_status: newStatus
                            })
                          })
                          
                          // Refresh orders
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
                            color: '#6b7280',
                            fontSize: '0.813rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
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

      {/* Installments Modal */}
      {showInstallments && selectedOrderId && (
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
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                Installments: Order #{selectedOrderNumber}
              </h2>
              <button
                onClick={() => setShowInstallments(false)}
                style={{
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

            {/* Summary */}
            {installments.length > 0 && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#f0f9ff',
                borderRadius: '6px',
                marginBottom: '1.5rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <div>
                    <strong>Total Due:</strong> ${installments.reduce((sum, i) => 
                      sum + parseFloat(i.amount_due), 0).toFixed(2)}
                  </div>
                  <div>
                    <strong>Total Paid:</strong> ${installments.reduce((sum, i) => 
                      sum + parseFloat(i.amount_paid || '0'), 0).toFixed(2)}
                  </div>
                  <div style={{ color: '#ef4444' }}>
                    <strong>Remaining:</strong> ${(installments.reduce((sum, i) => 
                      sum + parseFloat(i.amount_due), 0) - 
                      installments.reduce((sum, i) => 
                      sum + parseFloat(i.amount_paid || '0'), 0)).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Add Installment Button */}
            {!editingInstallment && !installmentNumber && (
              <button
                onClick={() => {
                  setInstallmentNumber(String(installments.length + 1))
                  setAmountDue('')
                  setAmountPaid('0')
                  setDueDate('')
                  setPaidDate('')
                  setInstallmentNotes('')
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '1.5rem',
                  fontWeight: '500',
                }}
              >
                + Add Installment
              </button>
            )}

            {/* Add/Edit Form */}
            {(editingInstallment || installmentNumber) && (
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
                  {editingInstallment ? 'Edit Installment' : 'New Installment'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Installment # *
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
                      Amount Due *
                    </label>
                    <input
                      type="text"
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
                      type="text"
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
