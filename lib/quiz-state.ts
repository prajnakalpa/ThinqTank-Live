export const getSecondsRemaining = (start: string, duration: number) => {
  const startTime = new Date(start).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - startTime) / 1000)
  return Math.max(duration - elapsed, 0)
}

export const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
