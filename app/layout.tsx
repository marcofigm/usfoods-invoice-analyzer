import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Los Pinos Invoice Analyzer',
  description: 'Comprehensive vendor invoice price analysis system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-white">{children}</body>
    </html>
  )
}