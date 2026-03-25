import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const steps = [
  {
    number: '01',
    title: 'Connect Strava',
    description: 'Link your Strava account with one click. CoachLM automatically syncs your activities, or import FIT files manually.',
  },
  {
    number: '02',
    title: 'Chat with your coach',
    description: 'Ask about your training, get pacing advice, discuss race strategy. The AI has full context of your running history.',
  },
  {
    number: '03',
    title: 'Train smarter',
    description: 'Get personalized training plans, track your load, and watch insights accumulate over time. Your coach learns as you go.',
  },
]

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !stepsRef.current) return

    const header = sectionRef.current.querySelector('.section-label')
    const title = sectionRef.current.querySelector('.section-title')
    const items = stepsRef.current.children

    gsap.set([header, title], { opacity: 0, y: 30 })
    gsap.set(items, { opacity: 0, x: -40 })

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 75%',
      onEnter: () => {
        gsap.to([header, title], {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
        })
        gsap.to(items, {
          opacity: 1,
          x: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
          delay: 0.2,
        })
      },
      once: true,
    })
  }, [])

  const stepsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    marginTop: 60,
  }

  const stepStyle: React.CSSProperties = {
    display: 'flex',
    gap: 32,
    padding: '40px 0',
    borderBottom: '1px solid var(--border)',
    alignItems: 'flex-start',
  }

  const numberStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 48,
    fontWeight: 800,
    color: 'var(--accent)',
    lineHeight: 1,
    opacity: 0.4,
    minWidth: 80,
  }

  const stepTitleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--text-1)',
    marginBottom: 8,
  }

  const stepDescStyle: React.CSSProperties = {
    fontSize: 15,
    color: 'var(--text-2)',
    lineHeight: 1.7,
    maxWidth: 500,
  }

  return (
    <section id="how-it-works" className="section" ref={sectionRef} style={{ background: 'var(--bg-1)' }}>
      <div className="section-inner">
        <div className="section-label">How it works</div>
        <h2 className="section-title">Up and running in minutes</h2>
        <div ref={stepsRef} style={stepsContainerStyle}>
          {steps.map((step) => (
            <div key={step.number} style={stepStyle}>
              <span style={numberStyle}>{step.number}</span>
              <div>
                <h3 style={stepTitleStyle}>{step.title}</h3>
                <p style={stepDescStyle}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
