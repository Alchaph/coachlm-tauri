import { useState, useEffect } from 'react'

const FALLBACK_URL = 'https://github.com/Alchaph/coachlm-tauri/releases/latest'
const API_URL = 'https://api.github.com/repos/Alchaph/coachlm-tauri/releases/latest'

export interface ReleaseAssets {
  macArm: string | null
  macIntel: string | null
  windows: string | null
  linux: string | null
  fallback: string
  loading: boolean
}

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  assets: GitHubAsset[]
}

export function useReleaseAssets(): ReleaseAssets {
  const [assets, setAssets] = useState<ReleaseAssets>({
    macArm: null,
    macIntel: null,
    windows: null,
    linux: null,
    fallback: FALLBACK_URL,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`)
        return res.json() as Promise<GitHubRelease>
      })
      .then((release) => {
        if (cancelled) return

        const find = (matcher: (name: string) => boolean): string | null => {
          const asset = release.assets.find((a) => matcher(a.name))
          return asset ? asset.browser_download_url : null
        }

        setAssets({
          macArm: find((n) => n.endsWith('aarch64.dmg')),
          macIntel: find((n) => n.endsWith('x64.dmg')),
          windows: find((n) => n.includes('x64-setup.exe')),
          linux: find((n) => n.endsWith('amd64.AppImage')),
          fallback: FALLBACK_URL,
          loading: false,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setAssets({
            macArm: null,
            macIntel: null,
            windows: null,
            linux: null,
            fallback: FALLBACK_URL,
            loading: false,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return assets
}

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (
    platform.startsWith('mac') ||
    ua.includes('macintosh') ||
    ua.includes('mac os x')
  ) {
    return 'mac'
  }

  if (
    platform.startsWith('win') ||
    ua.includes('windows')
  ) {
    return 'windows'
  }

  if (
    ua.includes('linux') ||
    ua.includes('x11') ||
    platform.startsWith('linux')
  ) {
    return 'linux'
  }

  return 'unknown'
}
