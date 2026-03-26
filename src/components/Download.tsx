import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReleaseAssets } from '../hooks/useReleaseAssets'

const macIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-1)">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const windowsIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-1)">
    <path d="M3 12V6.5l8-1.4V12H3zm0 .5h8v6.9l-8-1.4V12.5zM11.5 5l9.5-1.7V12H11.5V5zm0 7.5H21v8.7L11.5 19.5v-7z" />
  </svg>
)

const linuxIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-1)">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 01-.22-.253 1.86 1.86 0 01-.155-.247c-.043-.158-.086-.283-.129-.465l-.015-.065a.065.065 0 01-.016-.044v-.017c-.063-.27-.084-.601-.046-.905a.643.643 0 01.052-.163l.004-.004c.025-.036.044-.072.072-.072h.015z" />
  </svg>
)

export default function Download() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const releaseAssets = useReleaseAssets()

  useEffect(() => {
    if (!sectionRef.current || !cardsRef.current) return

    const header = sectionRef.current.querySelector('.section-label')
    const title = sectionRef.current.querySelector('.section-title')
    const subtitle = sectionRef.current.querySelector('.section-subtitle')
    const cards = cardsRef.current.children

    gsap.set([header, title, subtitle], { opacity: 0, y: 30 })
    gsap.set(cards, { opacity: 0, scale: 0.95 })

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 75%',
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
          scale: 1,
          duration: 0.6,
          stagger: 0.15,
          ease: 'back.out(1.4)',
          delay: 0.3,
        })
      },
      once: true,
    })
  }, [])

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 20,
    marginTop: 48,
    maxWidth: 780,
  }

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: '40px 24px',
    textAlign: 'center',
  }

  const platformNameStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-1)',
  }

  const extStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-3)',
    fontFamily: 'monospace',
  }

  const subBtnsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  }

  const subBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-2)',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'border-color 0.2s, color 0.2s',
  }

  const macArmHref = releaseAssets.macArm ?? releaseAssets.fallback
  const macIntelHref = releaseAssets.macIntel ?? releaseAssets.fallback
  const windowsHref = releaseAssets.windows ?? releaseAssets.fallback
  const linuxHref = releaseAssets.linux ?? releaseAssets.fallback

  return (
    <section id="download" className="section" ref={sectionRef} style={{ background: 'var(--bg-1)' }}>
      <div className="section-inner">
        <div className="section-label">Download</div>
        <h2 className="section-title">Ready to start training?</h2>
        <p className="section-subtitle">
          Download CoachLM for free. Available on all major platforms.
        </p>
        <div ref={cardsRef} style={gridStyle}>
          <div className="card" style={cardStyle}>
            {macIcon}
            <span style={platformNameStyle}>macOS</span>
            <span style={extStyle}>.dmg</span>
            <div style={subBtnsStyle}>
              <a
                href={macArmHref}
                target="_blank"
                rel="noopener noreferrer"
                style={subBtnStyle}
              >
                Apple Silicon
              </a>
              <a
                href={macIntelHref}
                target="_blank"
                rel="noopener noreferrer"
                style={subBtnStyle}
              >
                Intel
              </a>
            </div>
          </div>

          <a
            href={windowsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            style={cardStyle}
          >
            {windowsIcon}
            <span style={platformNameStyle}>Windows</span>
            <span style={extStyle}>.exe</span>
          </a>

          <a
            href={linuxHref}
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            style={cardStyle}
          >
            {linuxIcon}
            <span style={platformNameStyle}>Linux</span>
            <span style={extStyle}>.AppImage</span>
          </a>
        </div>
      </div>
    </section>
  )
}
