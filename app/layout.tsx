import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'ThinqTank Live',
  description: 'Challenge your mind. Compete. Win.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>

        {/* GLOBAL NAVBAR */}
        <Navbar />

        {/* PAGE CONTENT */}
        <div style={{ paddingTop: 64 }}>
          {children}
        </div>

        {/* GLOBAL FOOTER */}
        <Footer />

      </body>
    </html>
  )
}
