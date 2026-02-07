'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  // Redirect to orders by default
  useEffect(() => {
    router.push('/orders')
  }, [router])

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          🏒 WooCommerce Order Tracker
        </h1>
        <p style={{ color: '#666' }}>Shinny of Champions Registration Management</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <Link
          href="/orders"
          style={{
            padding: '2rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 0.2s',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Orders</h2>
          <p style={{ color: '#666' }}>View and filter WooCommerce orders, track payments and customer details</p>
        </Link>

        <Link
          href="/programs"
          style={{
            padding: '2rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 0.2s',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Programs</h2>
          <p style={{ color: '#666' }}>Manage program rosters, add players manually, export rosters</p>
        </Link>
      </div>
    </div>
  )
}
