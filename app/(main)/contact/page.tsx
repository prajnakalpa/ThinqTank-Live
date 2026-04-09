import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getCMSContent() {
  const supabase = createClient()
  const { data } = await supabase.from('site_content').select('key, value')
  return Object.fromEntries((data ?? []).map(({ key, value }) => [key, value]))
}

async function getStats() {
  const supabase = createClient()
  const [{ count: quizzes }, { count: students }] = await Promise.all([
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('type', 'quiz'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
  ])
  return { quizzes: quizzes ?? 0, students: students ?? 0 }
}

export default async function HomePage() {
  const [cms, stats] = await Promise.all([getCMSContent(), getStats()])

  return (
    <div className="relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-accent-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero */}
      <section className="page-container pt-24 pb-20 text-center relative">
        <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm text-brand-300 mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
          Live quizzes every week
        </div>

        <h1 className="font-display font-extrabold text-5xl md:text-7xl leading-[1.05] mb-6 animate-fade-up">
          {cms.hero_title?.split(' ').map((word: string, i: number) => (
            <span key={i} className={i > 1 ? 'gradient-text' : ''}>{word} </span>
          ))}
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-body animate-fade-up animate-delay-100">
          {cms.hero_subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up animate-delay-200">
          <Link href="/live" className="btn-primary text-base px-8 py-4">
            {cms.hero_cta || 'Join Now'} →
          </Link>
          <Link href="/leaderboard" className="btn-ghost text-base px-8 py-4">
            View Leaderboard
          </Link>
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto animate-fade-up animate-delay-300">
          {[
            { label: 'Quizzes Run', value: stats.quizzes },
            { label: 'Students', value: stats.students },
            { label: 'Weekly Prizes', value: '🏆' },
            { label: 'Live Every', value: 'Week' },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl p-4">
              <div className="font-display font-bold text-2xl text-white">{value}</div>
              <div className="text-gray-500 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="page-container py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="section-title mb-4">What is ThinqTank Live?</h2>
          <p className="text-gray-400 text-lg font-body leading-relaxed">{cms.about_text}</p>
        </div>
      </section>

      {/* Feature cards */}
      <section className="page-container py-10 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: '⚡',
              title: 'Weekly Live Quizzes',
              desc: 'Timed, competitive quizzes every week. Resume anytime before the deadline.'
            },
            {
              icon: '🏆',
              title: 'Real-Time Leaderboard',
              desc: 'Rankings update instantly. Climb the weekly and all-time boards.'
            },
            {
              icon: '🎯',
              title: 'Smart Scoring',
              desc: 'Keyword + fuzzy match evaluation. Partial credit for close answers.'
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="card-hover group">
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="font-display font-bold text-lg text-white mb-2 group-hover:text-brand-300 transition-colors">
                {title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
