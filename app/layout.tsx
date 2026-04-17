// app/layout.tsx
// Root layout — HTML shell ONLY.
// Each route group manages its own navigation:
//   app/(main)/layout.tsx  → Navbar + Footer for public pages
//   app/admin/layout.tsx   → sidebar nav for admin pages
//   app/quiz/layout.tsx    → standalone (full-screen quiz, no nav)
//   app/(auth)/layout.tsx  → standalone (full-screen auth pages, no nav)
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
