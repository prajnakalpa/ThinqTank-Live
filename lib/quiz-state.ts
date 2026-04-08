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
