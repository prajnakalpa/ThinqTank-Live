import type { Metadata } from 'next'
import './globals.css'

// ✅ CORRECT PATHS (based on what YOU confirmed)
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'ThinqTank Live',
  description: 'Challenge your mind. Compete. Win.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />

        {/* spacing so navbar doesn’t overlap */}
        <div style={{ paddingTop: 64 }}>
          {children}
        </div>

        <Footer />
      </body>
    </html>
  )
}
