import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { THEME_IDS, THEMES } from './themes'

const repositoryRoot = process.cwd()

describe('theme registry', () => {
  it('maps every theme to a complete isolated client root', () => {
    for (const theme of THEME_IDS) {
      const client = THEMES[theme]

      expect(client.root).toBe(`clients/${theme}`)
      expect(existsSync(resolve(repositoryRoot, client.root, 'index.html'))).toBe(true)
      expect(existsSync(resolve(repositoryRoot, client.root, 'src/app/main.tsx'))).toBe(true)
      expect(existsSync(resolve(repositoryRoot, client.root, 'public'))).toBe(true)
    }
  })

  it('assigns local-dev ports in registry order from 3000', () => {
    const launcher = readFileSync(resolve(repositoryRoot, 'scripts/theme-dev-servers.mjs'), 'utf8')
    const dev = readFileSync(resolve(repositoryRoot, 'scripts/dev-themes.mjs'), 'utf8')
    const local = readFileSync(resolve(repositoryRoot, 'scripts/dev-local.mjs'), 'utf8')

    expect(THEME_IDS.length).toBeGreaterThan(1)
    expect(launcher).toMatch(/const FIRST_PORT = 3000/u)
    expect(launcher).toMatch(/build\/themes\.json/u)
    expect(dev).toMatch(/listThemeDevServers/u)
    expect(local).toMatch(/listThemeDevServers/u)
  })

  it('keeps production build on a single THEME and starts every theme in dev', () => {
    const scripts = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ).scripts

    expect(scripts.build).toBe('tsc -b && vite build')
    expect(scripts.start).toBe('node server/src/index.ts')
    expect(scripts.fullstack).toBe('npm run build && node server/src/index.ts')
    expect(scripts.dev).toBe('node scripts/dev-themes.mjs')
    expect(scripts.local).toBe('node scripts/dev-local.mjs')
  })

  it('does not reuse a browser-storage namespace', () => {
    const namespaces = THEME_IDS.map((theme) => THEMES[theme].storageNamespace)

    expect(new Set(namespaces).size).toBe(namespaces.length)
  })

  it('keeps the registry aligned with each client storage implementation', () => {
    for (const theme of THEME_IDS) {
      const client = THEMES[theme]
      const sourceRoot = resolve(repositoryRoot, client.root, 'src')
      const database = readFileSync(
        resolve(sourceRoot, 'core/storage/IndexedDbStorageService.ts'),
        'utf8',
      )
      const login = readFileSync(
        resolve(sourceRoot, 'features/onboarding/model/login-credentials.ts'),
        'utf8',
      )
      const admin = readFileSync(resolve(sourceRoot, 'features/admin/model/admin-pass.ts'), 'utf8')
      const broadcast = readFileSync(
        resolve(sourceRoot, 'features/onboarding/model/WalletBroadcast.ts'),
        'utf8',
      )

      expect(database).toContain(`DEFAULT_DATABASE_NAME = '${client.storageNamespace}'`)
      expect(login).toContain(`'${client.storageNamespace}.login-credentials'`)
      expect(admin).toContain(`'${client.storageNamespace}.admin-pass'`)
      expect(broadcast).toContain(`name = '${client.storageNamespace}'`)
    }
  })
})
