import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'

const PARTICLE_COUNT = 2000

function createParticleSystem(): {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  particles: THREE.Points
  mouseTarget: THREE.Vector2
} {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  camera.position.z = 5

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const velocities = new Float32Array(PARTICLE_COUNT * 3)
  const colors = new Float32Array(PARTICLE_COUNT * 3)

  const accentColor = new THREE.Color('#e94560')
  const blueColor = new THREE.Color('#3b82f6')
  const whiteColor = new THREE.Color('#f0f4f8')

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3
    positions[i3] = (Math.random() - 0.5) * 12
    positions[i3 + 1] = (Math.random() - 0.5) * 12
    positions[i3 + 2] = (Math.random() - 0.5) * 8

    velocities[i3] = (Math.random() - 0.5) * 0.002
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.002
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.001

    const colorChoice = Math.random()
    const color = colorChoice < 0.3 ? accentColor : colorChoice < 0.6 ? blueColor : whiteColor
    colors[i3] = color.r
    colors[i3 + 1] = color.g
    colors[i3 + 2] = color.b
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))

  const material = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const particles = new THREE.Points(geometry, material)
  scene.add(particles)

  return { scene, camera, renderer, particles, mouseTarget: new THREE.Vector2(0, 0) }
}

export default function Hero() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const system = createParticleSystem()
    const { scene, camera, renderer, particles, mouseTarget } = system
    const container = canvasRef.current
    const mouse = new THREE.Vector2(0, 0)

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    resize()
    container.appendChild(renderer.domElement)

    const handleMouse = (e: MouseEvent) => {
      mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1
      mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouse, { passive: true })
    window.addEventListener('resize', resize)

    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      mouse.x += (mouseTarget.x - mouse.x) * 0.05
      mouse.y += (mouseTarget.y - mouse.y) * 0.05

      particles.rotation.y += 0.0003
      particles.rotation.x += 0.0001

      const posAttr = particles.geometry.getAttribute('position')
      const velAttr = particles.geometry.getAttribute('velocity')
      const pos = posAttr.array as Float32Array
      const vel = velAttr.array as Float32Array

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3
        pos[i3] += vel[i3] + mouse.x * 0.0002
        pos[i3 + 1] += vel[i3 + 1] + mouse.y * 0.0002
        pos[i3 + 2] += vel[i3 + 2]

        if (Math.abs(pos[i3]) > 6) vel[i3] *= -1
        if (Math.abs(pos[i3 + 1]) > 6) vel[i3 + 1] *= -1
        if (Math.abs(pos[i3 + 2]) > 4) vel[i3 + 2] *= -1
      }
      posAttr.needsUpdate = true

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('mousemove', handleMouse)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      particles.geometry.dispose()
      if (Array.isArray(particles.material)) {
        particles.material.forEach((m) => { m.dispose() })
      } else {
        particles.material.dispose()
      }
      container.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    if (!contentRef.current) return
    const els = contentRef.current.children

    gsap.set(els, { opacity: 0, y: 40 })
    gsap.to(els, {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.15,
      ease: 'power3.out',
      delay: 0.3,
    })
  }, [])

  const sectionStyle: React.CSSProperties = {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  }

  const contentStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 2,
    textAlign: 'center',
    maxWidth: 800,
    padding: '0 32px',
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderRadius: 100,
    border: '1px solid var(--border)',
    background: 'var(--bg-1)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-2)',
    marginBottom: 32,
  }

  const h1Style: React.CSSProperties = {
    fontSize: 'clamp(42px, 7vw, 80px)',
    lineHeight: 1.05,
    fontWeight: 800,
    marginBottom: 24,
    letterSpacing: '-0.03em',
  }

  const pStyle: React.CSSProperties = {
    fontSize: 'clamp(16px, 2vw, 20px)',
    color: 'var(--text-2)',
    lineHeight: 1.6,
    maxWidth: 560,
    margin: '0 auto 40px',
  }

  const btnsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  }

  const gradientStyle: React.CSSProperties = {
    position: 'absolute',
    top: '20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 800,
    height: 800,
    borderRadius: '50%',
    background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
    filter: 'blur(80px)',
    opacity: 0.3,
    pointerEvents: 'none',
    zIndex: 1,
  }

  return (
    <section style={sectionStyle}>
      <div ref={canvasRef} className="canvas-container" />
      <div style={gradientStyle} />
      <div ref={contentRef} style={contentStyle}>
        <div style={badgeStyle}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          100% local. 100% private.
        </div>
        <h1 style={h1Style}>
          Your AI{' '}
          <span style={{ color: 'var(--accent)' }}>running</span>{' '}
          coach
        </h1>
        <p style={pStyle}>
          Sync your runs from Strava, chat with a local AI, and get personalized training plans.
          No cloud. No telemetry. Just you and your data.
        </p>
        <div style={btnsStyle}>
          <a
            href="https://github.com/Alchaph/coachlm-tauri/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Download now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
          <a
            href="https://github.com/Alchaph/coachlm-tauri"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            View on GitHub
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
