import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-20 py-10">
      <div className="page-container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand-600 rounded-md flex items-center justify-center">
            <span className="font-display font-black text-xs text-white">TQ</span>
          </div>
          <span className="text-gray-500 text-sm font-body">ThinqTank Live © {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/live" className="hover:text-white transition-colors">Live</Link>
          <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboard</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  )
}
