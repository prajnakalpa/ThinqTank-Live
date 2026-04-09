'use client'

import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center p-4 border-b border-white/10">
      <Link href="/" className="font-bold text-lg text-white">
        ThinqTank Live
      </Link>

      <div className="flex gap-4 text-slate-300">
        <Link href="/live">Live</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/announcements">Announcements</Link>
        <Link href="/contact">Contact</Link>
      </div>
    </nav>
  )
}
