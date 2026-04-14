import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ThinqTank Live',
  description: 'Challenge your mind. Compete. Win.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
