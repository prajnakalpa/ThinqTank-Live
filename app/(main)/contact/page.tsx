export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

export default async function ContactPage() {
  const supabase = createClient()
  const { data: rows } = await supabase
    .from('site_content').select('key, value').eq('key', 'contact_email')
  const email = rows?.[0]?.value || 'hello@thinqtank.co.in'

  return (
    <div style={{ padding: '6rem 0 4rem' }}>
      <div className="page-container">
        <div style={{ maxWidth: 520 }}>
          <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>GET IN TOUCH</p>
          <h1 className="section-title" style={{ marginBottom: 12 }}>Contact Us</h1>
          <p style={{ color: '#475569', marginBottom: '2.5rem', lineHeight: 1.7 }}>
            Questions, feedback, or partnership ideas? Reach out.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>✉️</div>
              <div>
                <div style={{ color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Email</div>
                <a href={`mailto:${email}`} style={{ color: '#818cf8', textDecoration: 'none', fontSize: '0.9rem' }}>{email}</a>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🌐</div>
              <div>
                <div style={{ color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Website</div>
                <a href="https://thinqtank.co.in" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none', fontSize: '0.9rem' }}>thinqtank.co.in</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
