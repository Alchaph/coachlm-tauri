import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: 'Strava sync',
    description: 'Connect your Strava account and automatically sync all your activities. Pace, heart rate, distance, elevation — everything.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Chat with AI',
    description: 'Ask about your training, get advice on pacing, discuss recovery. Your AI coach knows your full running history.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Training plans',
    description: 'Generate personalized training plans based on your fitness level, goals, and schedule. From 5K to ultramarathon.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Fully local',
    description: 'Everything runs on your machine. Your data never leaves your computer. No cloud, no telemetry, no tracking.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Training load',
    description: 'Track your acute and chronic training load. See fatigue, fitness, and form trends over time.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: 'Context memory',
    description: 'The AI remembers insights from past chats. Your coach gets smarter the more you use it.',
  },
]

export default function Features() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !cardsRef.current) return

    const header = sectionRef.current.querySelector('.section-label')
    const title = sectionRef.current.querySelector('.section-title')
    const subtitle = sectionRef.current.querySelector('.section-subtitle')
    const cards = cardsRef.current.children

    gsap.set([header, title, subtitle], { opacity: 0, y: 30 })
    gsap.set(cards, { opacity: 0, y: 50 })

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 80%',
      onEnter: () => {
        gsap.to([header, title, subtitle], {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
        })
        gsap.to(cards, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          delay: 0.3,
        })
      },
      once: true,
    })
  }, [])

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    marginTop: 60,
  }

  const iconBoxStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  }

  const cardTitleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-1)',
    marginBottom: 8,
  }

  const cardDescStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--text-2)',
    lineHeight: 1.7,
  }

  return (
    <section id="features" className="section" ref={sectionRef}>
      <div className="section-inner">
        <div className="section-label">Features</div>
        <h2 className="section-title">Everything you need to train smarter</h2>
        <p className="section-subtitle">
          Built for runners who want data-driven insights without sacrificing privacy.
        </p>
        <div ref={cardsRef} style={gridStyle}>
          {features.map((feature) => (
            <div key={feature.title} className="card">
              <div style={iconBoxStyle}>{feature.icon}</div>
              <h3 style={cardTitleStyle}>{feature.title}</h3>
              <p style={cardDescStyle}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
