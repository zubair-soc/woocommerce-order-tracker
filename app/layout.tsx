import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WooCommerce Order Tracker',
  description: 'Track and manage WooCommerce orders for Shinny of Champions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
