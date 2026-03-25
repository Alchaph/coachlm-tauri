import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const privacyPoints = [
  'Runs 100% on your machine',
  'No cloud servers or external APIs',
  'No telemetry or usage tracking',
  'No account required',
  'SQLite database stored locally',
  'Open source and auditable',
]

export default function Privacy() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !headlineRef.current || !gridRef.current) return

    const label = sectionRef.current.querySelector('.section-label')
    const subtitle = sectionRef.current.querySelector('.section-subtitle')
    const items = gridRef.current.children

    const words = headlineRef.current.querySelectorAll('.word')

    gsap.set([label, subtitle], { opacity: 0, y: 30 })
    gsap.set(words, { opacity: 0, y: 20 })
    gsap.set(items, { opacity: 0, y: 20 })

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 75%',
      onEnter: () => {
        gsap.to(label, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
        gsap.to(words, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.06,
          ease: 'power3.out',
          delay: 0.1,
        })
        gsap.to(subtitle, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.4 })
        gsap.to(items, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: 'power3.out',
          delay: 0.6,
        })
      },
      once: true,
    })
  }, [])

  const headlineText = 'Your data stays on your machine. Period.'

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    marginTop: 48,
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    background: 'var(--bg-1)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-1)',
  }

  const checkStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'var(--bg-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  return (
    <section id="privacy" className="section" ref={sectionRef}>
      <div className="section-inner">
        <div className="section-label">Privacy-first</div>
        <h2 className="section-title" ref={headlineRef}>
          {headlineText.split(' ').map((word, i) => (
            <span key={i} className="word" style={{ display: 'inline-block', marginRight: '0.3em' }}>
              {word}
            </span>
          ))}
        </h2>
        <p className="section-subtitle">
          CoachLM uses Ollama to run AI models locally. Your conversations, activities, and insights
          never leave your computer.
        </p>
        <div ref={gridRef} style={gridStyle}>
          {privacyPoints.map((point) => (
            <div key={point} style={itemStyle}>
              <div style={checkStyle}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              {point}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
