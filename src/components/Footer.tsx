export default function Footer() {
  const footerStyle: React.CSSProperties = {
    borderTop: '1px solid var(--border)',
    padding: '48px 32px',
  }

  const innerStyle: React.CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 24,
  }

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-1)',
  }

  const linksStyle: React.CSSProperties = {
    display: 'flex',
    gap: 24,
    alignItems: 'center',
  }

  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-3)',
    transition: 'color 0.2s',
  }

  const copyrightStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-3)',
  }

  return (
    <footer style={footerStyle}>
      <div style={innerStyle}>
        <div style={logoStyle}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="CoachLM" width={24} height={24} />
          <span>CoachLM</span>
        </div>
        <div style={linksStyle}>
          <a
            href="https://github.com/Alchaph/coachlm-tauri"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            GitHub
          </a>
          <a
            href="https://github.com/Alchaph/coachlm-tauri/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            Releases
          </a>
          <a
            href="https://github.com/Alchaph/coachlm-tauri/issues"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            Issues
          </a>
        </div>
        <span style={copyrightStyle}>
          Built with Tauri, React, and Ollama
        </span>
      </div>
    </footer>
  )
}
