import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDirectoryAndPriceFetch } from '@/test/doubles'

import { DirectorySessionProvider } from './directory-session'
import { clearLoginCredentials, writeLoginCredentials } from './login-credentials'
import { useRefreshRemoteAssets } from './use-refresh-remote-assets'
import { useUserReceivings } from './use-user-receivings'
import { useUserSendings } from './use-user-sendings'

function Probe() {
  useRefreshRemoteAssets()
  useUserSendings()
  useUserReceivings()
  return null
}

function countGets(pattern: RegExp): number {
  return vi.mocked(globalThis.fetch).mock.calls.filter(([url, init]) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    return method === 'GET' && pattern.test(String(url).split('?')[0] ?? '')
  }).length
}

function countProfileGets(): number {
  return countGets(/\/v1\/users\/7$/u)
}

afterEach(() => {
  localStorage.clear()
  clearLoginCredentials()
})

beforeEach(() => {
  localStorage.clear()
  clearLoginCredentials()
  globalThis.fetch = mockDirectoryAndPriceFetch({
    id: '7',
    email: 'james@example.com',
    balance: '12.5',
    createdAt: '2026-08-19T12:00:00.000Z',
  })
})

describe('useRefreshRemoteAssets', () => {
  it('does not keep calling GET /v1/users/:id after the snapshot updates', async () => {
    writeLoginCredentials({
      id: '7',
      email: 'james@example.com',
      theP: 'demo',
    })

    render(
      <DirectorySessionProvider>
        <Probe />
      </DirectorySessionProvider>,
    )

    await waitFor(() => {
      expect(countProfileGets()).toBeGreaterThan(0)
    })

    await new Promise((resolve) => {
      window.setTimeout(resolve, 150)
    })

    expect(countProfileGets()).toBeLessThanOrEqual(4)
    expect(countGets(/\/v1\/users\/7\/sendings$/u)).toBeLessThanOrEqual(2)
    expect(countGets(/\/v1\/users\/7\/receivings$/u)).toBeLessThanOrEqual(2)
  })
})
