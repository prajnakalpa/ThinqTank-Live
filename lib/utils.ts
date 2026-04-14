// lib/utils.ts
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(iso: string) {
  return format(new Date(iso), 'dd MMM yyyy, hh:mm a')
}

export function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export function statusColor(status: string) {
  return {
    upcoming: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    live:     'bg-green-500/20 text-green-300 border-green-500/30',
    closed:   'bg-gray-500/20 text-gray-400 border-gray-500/30',
    archived: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }[status] ?? 'bg-gray-500/20 text-gray-400'
}

export function rankEmoji(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
}

export function truncate(str: string, len = 80) {
  return str.length > len ? str.slice(0, len) + '…' : str
}

/**
 * Returns the base URL of the app — works across:
 *   - local dev      (http://localhost:3000/)
 *   - Vercel preview (https://xxx.vercel.app/)
 *   - production     (https://thinq-tank-live.vercel.app/)
 *
 * Use this for all Supabase redirectTo URLs.
 * NEVER hardcode URLs.
 */
export function getURL(): string {
  // 1. Explicit production URL (set this in Vercel env vars)
  let url = process.env.NEXT_PUBLIC_SITE_URL

  // 2. Vercel preview/branch URL
  if (!url && process.env.NEXT_PUBLIC_VERCEL_URL) {
    url = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  // 3. Local dev fallback
  if (!url) {
    url = 'http://localhost:3000'
  }

  // Ensure trailing slash
  return url.endsWith('/') ? url : `${url}/`
}
