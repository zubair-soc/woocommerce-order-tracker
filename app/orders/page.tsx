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

  // Fetch orders and products from Supabase
  const fetchOrders = async () => {
    setLoading(true)
    
    // Fetch orders
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
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

    setFilteredOrders(filtered)
    setCurrentPage(1) // Reset to page 1 when filters change
  }, [searchTerm, statusFilter, selectedCourses, dateFrom, dateTo, orders])

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
  }, [])

  // Get unique statuses for filter dropdown
  const statuses = Array.from(new Set(orders.map((o) => o.status)))

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          📦 Orders
        </h1>
        <p style={{ color: '#666' }}>WooCommerce order tracking and filtering</p>
      </div>

      {/* Sync Button and Navigation */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
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
          }}
        >
          📋 Manage Programs
        </a>
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
