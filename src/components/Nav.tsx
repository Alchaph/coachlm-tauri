import { useEffect, useRef, useState } from 'react'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => { window.removeEventListener('scroll', handleScroll) }
  }, [])

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '0 32px',
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    background: scrolled ? 'rgba(8, 12, 16, 0.85)' : 'transparent',
    backdropFilter: scrolled ? 'blur(20px) saturate(1.4)' : 'none',
    borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
  }

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-1)',
    letterSpacing: '-0.02em',
  }

  const linksStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
  }

  const linkStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-2)',
    transition: 'color 0.2s',
    cursor: 'pointer',
  }

  const mobileMenuStyle: React.CSSProperties = {
    display: mobileOpen ? 'flex' : 'none',
    position: 'fixed',
    top: 72,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--bg-0)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    zIndex: 99,
  }

  const hamburgerStyle: React.CSSProperties = {
    display: 'none',
    flexDirection: 'column',
    gap: 5,
    cursor: 'pointer',
    padding: 8,
  }

  const barStyle = (index: number): React.CSSProperties => ({
    width: 22,
    height: 2,
    background: 'var(--text-1)',
    borderRadius: 1,
    transition: 'all 0.3s',
    transform: mobileOpen
      ? index === 0
        ? 'rotate(45deg) translate(5px, 5px)'
        : index === 1
          ? 'opacity: 0'
          : 'rotate(-45deg) translate(5px, -5px)'
      : 'none',
    opacity: mobileOpen && index === 1 ? 0 : 1,
  })

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
      setMobileOpen(false)
    }
  }

  const navLinks = [
    { label: 'Features', id: 'features' },
    { label: 'How it works', id: 'how-it-works' },
    { label: 'Privacy', id: 'privacy' },
    { label: 'Download', id: 'download' },
  ]

  return (
    <>
      <nav ref={navRef} style={navStyle}>
        <div style={logoStyle}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="CoachLM" width={28} height={28} />
          <span>CoachLM</span>
        </div>

        <div className="nav-links" style={linksStyle}>
          {navLinks.map((link) => (
            <span
              key={link.id}
              style={linkStyle}
              onClick={() => { scrollTo(link.id) }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-2)' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') scrollTo(link.id) }}
            >
              {link.label}
            </span>
          ))}
          <a
            href="https://github.com/Alchaph/coachlm-tauri"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '10px 20px', fontSize: 13 }}
          >
            Get started
          </a>
        </div>

        <div
          className="hamburger"
          style={hamburgerStyle}
          onClick={() => { setMobileOpen(!mobileOpen) }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setMobileOpen(!mobileOpen) }}
          aria-label="Toggle menu"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={barStyle(i)} />
          ))}
        </div>
      </nav>

      <div style={mobileMenuStyle}>
        {navLinks.map((link) => (
          <span
            key={link.id}
            style={{ ...linkStyle, fontSize: 24 }}
            onClick={() => { scrollTo(link.id) }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') scrollTo(link.id) }}
          >
            {link.label}
          </span>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
