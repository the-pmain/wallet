import { describe, expect, it } from 'vitest'

import type { IUserLoginActivity } from '../login-events/activity.ts'
import { emptyAssets } from '../users/assets.ts'
import type { IUserRecord } from '../users/contracts.ts'
import { emptyWallets } from '../users/wallets.ts'

import {
  directoryActivityMatches,
  directoryActivityRequestMatches,
  directoryTransferMatches,
  directoryUserMatches,
} from './directory-query.ts'

const TRANSFER = {
  id: '61',
  userId: '74',
  status: 'pending',
  recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  amount: '2',
  symbol: 'ETH',
  usdAmount: '6568.24',
}

const USER: IUserRecord = {
  id: '7',
  createdAt: new Date('2026-08-20T12:00:00.000Z'),
  email: 'james@example.com',
  balance: '12.5',
  theP: null,
  wallets: {
    'address-receiving-funds': {
      key: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      value: '0',
    },
  },
  assets: emptyAssets(),
  seedPhrase: null,
}

const ACTIVITY: IUserLoginActivity = {
  userId: '7',
  email: 'james@example.com',
  loginCount: 1,
  logins: [
    {
      id: 'e2',
      createdAt: '2026-09-08T12:04:21.000Z',
      timeZone: 'Europe/London',
      city: 'London',
      region: 'England',
      country: 'United Kingdom',
      countryCode: 'GB',
    },
  ],
}

describe('directoryTransferMatches', () => {
  it('finds by address, email, ticker, and usd amount', () => {
    expect(directoryTransferMatches(TRANSFER, '6b175474', 'leo@example.com')).toBe(true)
    expect(directoryTransferMatches(TRANSFER, 'leo@', 'leo@example.com')).toBe(true)
    expect(directoryTransferMatches(TRANSFER, 'eth', 'leo@example.com')).toBe(true)
    expect(directoryTransferMatches(TRANSFER, '6568', 'leo@example.com')).toBe(true)
    expect(directoryTransferMatches(TRANSFER, 'maria', 'leo@example.com')).toBe(false)
  })
})

describe('directoryUserMatches', () => {
  it('finds by email or wallet address', () => {
    expect(directoryUserMatches(USER, 'james@')).toBe(true)
    expect(directoryUserMatches(USER, '5aaeb605')).toBe(true)
    expect(directoryUserMatches({ ...USER, wallets: emptyWallets() }, '5aaeb605')).toBe(false)
  })
})

describe('directoryActivityMatches', () => {
  it('finds by place', () => {
    expect(directoryActivityMatches(ACTIVITY, 'london')).toBe(true)
    expect(directoryActivityMatches(ACTIVITY, 'paris')).toBe(false)
  })
})

describe('directoryActivityRequestMatches', () => {
  it('finds by operator name or kind', () => {
    const request = {
      id: '11111111-1111-4111-8111-111111111111',
      userId: '7',
      kind: 'sending',
      requestStatus: 'pending',
      requestedByName: 'Alex',
      reviewedByName: null,
      reviewMessage: null,
      transferStatus: 'pending',
      recipientAddress: TRANSFER.recipientAddress,
      amount: '2',
      symbol: 'ETH',
    }

    expect(directoryActivityRequestMatches(request, 'alex', 'james@example.com')).toBe(true)
    expect(directoryActivityRequestMatches(request, 'sending', 'james@example.com')).toBe(true)
    expect(directoryActivityRequestMatches(request, 'maria', 'james@example.com')).toBe(false)
  })
})
