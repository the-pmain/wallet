import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { loadLocalEnv } from './load-env.ts'

const KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'HOST'] as const

const snapshot = new Map<string, string | undefined>()

function isolateEnv(): void {
  for (const key of KEYS) {
    snapshot.set(key, process.env[key])
    delete process.env[key]
  }
}

afterEach(() => {
  for (const key of KEYS) {
    const previous = snapshot.get(key)

    if (previous === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previous
    }
  }

  snapshot.clear()
})

describe('loadLocalEnv', () => {
  it('lets .env.local override a hosted SUPABASE_URL from .env', () => {
    isolateEnv()
    const root = mkdtempSync(join(tmpdir(), 'elm-env-'))

    try {
      writeFileSync(
        join(root, '.env'),
        'SUPABASE_URL=https://example.supabase.co\nHOST=127.0.0.1\n',
      )
      writeFileSync(join(root, '.env.local'), 'SUPABASE_URL=http://127.0.0.1:54321\n')
      mkdirSync(join(root, 'server'))

      loadLocalEnv(root)

      expect(process.env['SUPABASE_URL']).toBe('http://127.0.0.1:54321')
      expect(process.env['HOST']).toBe('127.0.0.1')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not let .env override a variable already set in the process', () => {
    isolateEnv()
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321'
    const root = mkdtempSync(join(tmpdir(), 'elm-env-'))

    try {
      writeFileSync(join(root, '.env'), 'SUPABASE_URL=https://example.supabase.co\n')

      loadLocalEnv(root)

      expect(process.env['SUPABASE_URL']).toBe('http://127.0.0.1:54321')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('lets .env.local override a hosted SUPABASE_URL already set in the process', () => {
    isolateEnv()
    process.env['SUPABASE_URL'] = 'https://example.supabase.co'
    const root = mkdtempSync(join(tmpdir(), 'elm-env-'))

    try {
      writeFileSync(join(root, '.env.local'), 'SUPABASE_URL=http://127.0.0.1:55321\n')

      loadLocalEnv(root)

      expect(process.env['SUPABASE_URL']).toBe('http://127.0.0.1:55321')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
