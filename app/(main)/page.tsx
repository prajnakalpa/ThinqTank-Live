'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ overflow: 'hidden' }}>

      {/* ── HERO ── */}
      <section style={{ padding: '8rem 0 5rem', position: 'relative' }}>
        {/* Ambient orbs */}
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '-5%', width: 400, height: 400, background: 'radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="page-container" style={{ textAlign: 'center', position: 'relative' }}>

          {/* Pill badge */}
          <div className="animate-fade-in" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 99, padding: '6px 16px', marginBottom: 32,
          }}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span className="live-dot" />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'block', position: 'relative', zIndex: 1 }} />
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>Live quizzes every week</span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up" style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800, fontSize: 'clamp(2.5rem, 7vw, 5rem)',
            lineHeight: 1.08, color: '#f1f5f9', marginBottom: 24,
          }}>
            Welcome to <span className="gradient-text">ThinqTank Live</span>
          </h1>

          <p className="animate-fade-up animate-delay-1" style={{ color: '#64748b', fontSize: 'clamp(1rem, 2vw, 1.2rem)', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Challenge your mind. Compete with the best. Rise up the leaderboard.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up animate-delay-2" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/live" className="btn-primary" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
              Join Now →
            </Link>
            <Link href="/leaderboard" className="btn-ghost" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
              View Leaderboard
            </Link>
          </div>

          {/* Stats row */}
          <div className="animate-fade-up animate-delay-3" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 16, maxWidth: 640, margin: '4rem auto 0',
          }}>
            {[
              { value: '∞', label: 'Quizzes', icon: '⚡' },
              { value: '∞', label: 'Students', icon: '👥' },
              { value: '🏆', label: 'Weekly Prizes', icon: '' },
              { value: 'Weekly', label: 'Cadence', icon: '📅' },
            ].map(({ value, label, icon }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)',
                borderRadius: 16, padding: '1.25rem 1rem', textAlign: 'center',
              }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.6rem', color: '#e2e8f0' }}>{value}</div>
                <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="page-container"><div className="glow-line" /></div>

      {/* ── ABOUT ── */}
      <section style={{ padding: '5rem 0' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>ABOUT</p>
          <h2 className="section-title" style={{ marginBottom: 16 }}>What is ThinqTank Live?</h2>
          <p style={{ color: '#64748b', lineHeight: 1.8, fontSize: '1rem' }}>
            ThinqTank Live is a competitive quiz platform for curious minds. Weekly quizzes, real-time rankings, and a community that loves to think.
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '0 0 6rem' }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {[
              { icon: '⚡', title: 'Weekly Live Quizzes', desc: 'Timed, competitive quizzes every week. Resume anytime before the deadline.', color: '#f59e0b' },
              { icon: '🏆', title: 'Real-Time Leaderboard', desc: 'Rankings update the moment you submit. Climb the weekly and all-time boards.', color: '#6366f1' },
              { icon: '🎯', title: 'Smart Scoring', desc: 'Keyword + fuzzy match evaluation. Your answer is evaluated for intent, not just exact wording.', color: '#22c55e' },
            ].map(({ icon, title, desc, color }) => (
              <div key={title} className="card-hover" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />
                <div style={{ fontSize: '1.75rem', marginBottom: 16 }}>{icon}</div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#e2e8f0', marginBottom: 8 }}>{title}</h3>
                <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
