import { describe, expect, it } from 'vitest'

import { isLocalSupabaseUrl } from './supabase-url.ts'

describe('isLocalSupabaseUrl', () => {
  it('accepts loopback API URLs', () => {
    expect(isLocalSupabaseUrl('http://127.0.0.1:54321')).toBe(true)
    expect(isLocalSupabaseUrl('http://localhost:54321')).toBe(true)
    expect(isLocalSupabaseUrl('http://127.0.0.1:54321/')).toBe(true)
  })

  it('rejects hosted project URLs', () => {
    expect(isLocalSupabaseUrl('https://example.supabase.co')).toBe(false)
    expect(isLocalSupabaseUrl('https://abcdefghijklmnop.supabase.co')).toBe(false)
  })

  it('rejects empty and unparseable values', () => {
    expect(isLocalSupabaseUrl('')).toBe(false)
    expect(isLocalSupabaseUrl('not-a-url')).toBe(false)
  })
})
