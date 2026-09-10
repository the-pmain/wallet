import { sha256 } from '@noble/hashes/sha2.js'

import { hasAddressShape } from './address.ts'

/** Shortest classic Bitcoin / Dogecoin Base58Check address. */
export const RECIPIENT_ADDRESS_MIN_LENGTH = 26

/** Long enough for Cardano Shelley and a pasted payment URI remainder. */
export const RECIPIENT_ADDRESS_MAX_LENGTH = 200

/**
 * Supported wallet families for the recipient field.
 *
 * Directory sends are executed by an operator, so the field must
 * accept more than an EVM address. Each kind is identified by its
 * own alphabet and checksum — a regex-only check would treat a typo
 * as a different, unspendable wallet.
 */
export const CRYPTO_WALLET_KIND = {
  Evm: 'evm',
  Bitcoin: 'bitcoin',
  BitcoinTestnet: 'bitcoin-testnet',
  Litecoin: 'litecoin',
  Dogecoin: 'dogecoin',
  Solana: 'solana',
  Tron: 'tron',
  Xrp: 'xrp',
  Cosmos: 'cosmos',
  Cardano: 'cardano',
  Ton: 'ton',
  Move: 'move',
} as const

export type CryptoWalletKind = (typeof CRYPTO_WALLET_KIND)[keyof typeof CRYPTO_WALLET_KIND]

const BTC_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const XRP_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const BECH32_CONST = 1
const BECH32M_CONST = 0x2bc830a3
const BECH32_GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

const WALLET_URI_SCHEMES = new Set([
  'bitcoin',
  'ethereum',
  'litecoin',
  'dogecoin',
  'solana',
  'tron',
  'ripple',
  'xrp',
  'ton',
  'cosmos',
  'cardano',
])

const COSMOS_HRPS = new Set([
  'cosmos',
  'osmo',
  'celestia',
  'inj',
  'sei',
  'noble',
  'dydx',
  'stars',
  'juno',
  'akash',
  'secret',
  'kava',
  'evmos',
  'stride',
  'neutron',
  'saga',
  'babylon',
  'tia',
  'atom',
  'terra',
  'persistence',
  'regen',
  'somm',
  'umee',
])

const MOVE_ADDRESS = /^0x[0-9a-fA-F]{64}$/u
const TON_RAW = /^-?\d+:[0-9a-fA-F]{64}$/u
const TON_FRIENDLY = /^[A-Za-z0-9_-]{48}$/u

/**
 * Strips a payment URI scheme and query so pasted `bitcoin:…?amount=`
 * values are checked as the address itself.
 */
export function normalizeCryptoWalletInput(value: string): string {
  const trimmed = value.trim()
  const colon = trimmed.indexOf(':')

  if (colon > 0 && colon <= 16) {
    const scheme = trimmed.slice(0, colon).toLowerCase()

    if (WALLET_URI_SCHEMES.has(scheme)) {
      const rest = trimmed.slice(colon + 1)
      const query = rest.indexOf('?')

      return (query === -1 ? rest : rest.slice(0, query)).trim()
    }
  }

  return trimmed
}

/** Whether the string is a checksum-valid wallet address of a known kind. */
export function isValidCryptoWalletAddress(value: string): boolean {
  return identifyCryptoWallet(value) !== null
}

/** Identifies the wallet family, or `null` when the string is not one. */
export function identifyCryptoWallet(value: string): CryptoWalletKind | null {
  const normalized = normalizeCryptoWalletInput(value)

  if (normalized === '') {
    return null
  }

  if (hasAddressShape(normalized)) {
    return CRYPTO_WALLET_KIND.Evm
  }

  if (MOVE_ADDRESS.test(normalized)) {
    return CRYPTO_WALLET_KIND.Move
  }

  const bech32 = decodeBech32(normalized)

  if (bech32 !== null) {
    return identifyBech32Wallet(bech32)
  }

  if (isTonAddress(normalized)) {
    return CRYPTO_WALLET_KIND.Ton
  }

  const btcPayload = decodeBase58Check(normalized, BTC_ALPHABET)

  if (btcPayload !== null && btcPayload.length === 21) {
    const version = btcPayload[0]

    if (version === 0x00 || version === 0x05) {
      return CRYPTO_WALLET_KIND.Bitcoin
    }

    if (version === 0x6f || version === 0xc4) {
      return CRYPTO_WALLET_KIND.BitcoinTestnet
    }

    if (version === 0x30 || version === 0x32) {
      return CRYPTO_WALLET_KIND.Litecoin
    }

    if (version === 0x1e || version === 0x16) {
      return CRYPTO_WALLET_KIND.Dogecoin
    }

    if (version === 0x41) {
      return CRYPTO_WALLET_KIND.Tron
    }
  }

  const xrpPayload = decodeBase58Check(normalized, XRP_ALPHABET)

  if (xrpPayload !== null && xrpPayload.length === 21 && xrpPayload[0] === 0x00) {
    return CRYPTO_WALLET_KIND.Xrp
  }

  if (isSolanaAddress(normalized)) {
    return CRYPTO_WALLET_KIND.Solana
  }

  return null
}

/** Short label for the hint under the recipient field. */
export function cryptoWalletKindLabel(kind: CryptoWalletKind): string {
  switch (kind) {
    case CRYPTO_WALLET_KIND.Evm:
      return 'EVM'
    case CRYPTO_WALLET_KIND.Bitcoin:
      return 'Bitcoin'
    case CRYPTO_WALLET_KIND.BitcoinTestnet:
      return 'Bitcoin testnet'
    case CRYPTO_WALLET_KIND.Litecoin:
      return 'Litecoin'
    case CRYPTO_WALLET_KIND.Dogecoin:
      return 'Dogecoin'
    case CRYPTO_WALLET_KIND.Solana:
      return 'Solana'
    case CRYPTO_WALLET_KIND.Tron:
      return 'TRON'
    case CRYPTO_WALLET_KIND.Xrp:
      return 'XRP'
    case CRYPTO_WALLET_KIND.Cosmos:
      return 'Cosmos'
    case CRYPTO_WALLET_KIND.Cardano:
      return 'Cardano'
    case CRYPTO_WALLET_KIND.Ton:
      return 'TON'
    case CRYPTO_WALLET_KIND.Move:
      return 'Aptos or Sui'
  }
}

interface IBech32Decoded {
  readonly hrp: string
  readonly data: readonly number[]
  readonly encoding: 'bech32' | 'bech32m'
}

function identifyBech32Wallet(decoded: IBech32Decoded): CryptoWalletKind | null {
  if (decoded.hrp === 'bc' || decoded.hrp === 'tb' || decoded.hrp === 'bcrt') {
    return isSegwitProgram(decoded) ? bitcoinKindForHrp(decoded.hrp) : null
  }

  if (decoded.hrp === 'ltc' || decoded.hrp === 'tltc') {
    return isSegwitProgram(decoded) ? CRYPTO_WALLET_KIND.Litecoin : null
  }

  if (decoded.hrp === 'addr' || decoded.hrp === 'addr_test') {
    return decoded.encoding === 'bech32' ? CRYPTO_WALLET_KIND.Cardano : null
  }

  if (COSMOS_HRPS.has(decoded.hrp)) {
    return decoded.encoding === 'bech32' ? CRYPTO_WALLET_KIND.Cosmos : null
  }

  return null
}

function bitcoinKindForHrp(hrp: string): CryptoWalletKind {
  return hrp === 'bc' ? CRYPTO_WALLET_KIND.Bitcoin : CRYPTO_WALLET_KIND.BitcoinTestnet
}

function isSegwitProgram(decoded: IBech32Decoded): boolean {
  if (decoded.data.length < 1) {
    return false
  }

  const version = decoded.data[0] as number

  if (version < 0 || version > 16) {
    return false
  }

  if (version === 0 && decoded.encoding !== 'bech32') {
    return false
  }

  if (version > 0 && decoded.encoding !== 'bech32m') {
    return false
  }

  const program = convertBits(decoded.data.slice(1), 5, 8, false)

  if (program === null) {
    return false
  }

  if (version === 0) {
    return program.length === 20 || program.length === 32
  }

  if (version === 1) {
    return program.length === 32
  }

  return program.length >= 2 && program.length <= 40
}

function decodeBech32(value: string): IBech32Decoded | null {
  if (value !== value.toLowerCase() && value !== value.toUpperCase()) {
    return null
  }

  const lowered = value.toLowerCase()
  const separator = lowered.lastIndexOf('1')

  if (separator < 1 || separator + 7 > lowered.length) {
    return null
  }

  const hrp = lowered.slice(0, separator)
  const maxLength = hrp === 'addr' || hrp === 'addr_test' ? 128 : 90

  if (lowered.length > maxLength) {
    return null
  }

  const payload = lowered.slice(separator + 1)

  if (!/^[a-z][a-z0-9]*$/u.test(hrp)) {
    return null
  }

  const data: number[] = []

  for (const character of payload) {
    const index = BECH32_CHARSET.indexOf(character)

    if (index === -1) {
      return null
    }

    data.push(index)
  }

  const checksum = bech32Polymod([...hrpExpand(hrp), ...data])
  const encoding =
    checksum === BECH32_CONST ? 'bech32' : checksum === BECH32M_CONST ? 'bech32m' : null

  if (encoding === null) {
    return null
  }

  return { hrp, data: data.slice(0, -6), encoding }
}

function bech32Polymod(values: readonly number[]): number {
  let chk = 1

  for (const value of values) {
    const top = chk >>> 25
    chk = ((chk & 0x1ffffff) << 5) ^ value

    for (let index = 0; index < 5; index += 1) {
      if (((top >>> index) & 1) !== 0) {
        chk ^= BECH32_GENERATORS[index] as number
      }
    }
  }

  return chk >>> 0
}

function hrpExpand(hrp: string): number[] {
  const result: number[] = []

  for (const character of hrp) {
    result.push(character.charCodeAt(0) >>> 5)
  }

  result.push(0)

  for (const character of hrp) {
    result.push(character.charCodeAt(0) & 31)
  }

  return result
}

function convertBits(
  data: readonly number[],
  fromBits: number,
  toBits: number,
  pad: boolean,
): number[] | null {
  let acc = 0
  let bits = 0
  const maxValue = (1 << toBits) - 1
  const result: number[] = []

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) {
      return null
    }

    acc = (acc << fromBits) | value
    bits += fromBits

    while (bits >= toBits) {
      bits -= toBits
      result.push((acc >> bits) & maxValue)
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxValue)
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxValue) !== 0) {
    return null
  }

  return result
}

function decodeBase58Check(value: string, alphabet: string): Uint8Array | null {
  const decoded = decodeBase58(value, alphabet)

  if (decoded === null || decoded.length < 5) {
    return null
  }

  const payload = decoded.slice(0, -4)
  const checksum = decoded.slice(-4)
  const digest = sha256(sha256(payload))

  if (
    checksum[0] !== digest[0] ||
    checksum[1] !== digest[1] ||
    checksum[2] !== digest[2] ||
    checksum[3] !== digest[3]
  ) {
    return null
  }

  return payload
}

function decodeBase58(value: string, alphabet: string): Uint8Array | null {
  if (value.length === 0) {
    return null
  }

  let leadingZeros = 0

  while (leadingZeros < value.length && value[leadingZeros] === alphabet[0]) {
    leadingZeros += 1
  }

  const size = Math.ceil((value.length * Math.log2(58)) / 8) + 1
  const bytes = new Uint8Array(size)

  for (const character of value) {
    let carry = alphabet.indexOf(character)

    if (carry === -1) {
      return null
    }

    for (let index = size - 1; index >= 0; index -= 1) {
      carry += 58 * (bytes[index] as number)
      bytes[index] = carry & 0xff
      carry >>>= 8
    }

    if (carry !== 0) {
      return null
    }
  }

  let start = 0

  while (start < bytes.length && bytes[start] === 0) {
    start += 1
  }

  const result = new Uint8Array(leadingZeros + (bytes.length - start))
  result.set(bytes.slice(start), leadingZeros)

  return result
}

function isSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) {
    return false
  }

  const decoded = decodeBase58(value, BTC_ALPHABET)

  return decoded !== null && decoded.length === 32
}

function isTonAddress(value: string): boolean {
  if (TON_RAW.test(value)) {
    return true
  }

  if (!TON_FRIENDLY.test(value)) {
    return false
  }

  const bytes = decodeBase64Url(value)

  if (bytes === null || bytes.length !== 36) {
    return false
  }

  const expected = crc16Xmodem(bytes.subarray(0, 34))

  return bytes[34] === expected[0] && bytes[35] === expected[1]
}

function decodeBase64Url(value: string): Uint8Array | null {
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/')
  const remainder = padded.length % 4
  const complete = remainder === 0 ? padded : `${padded}${'='.repeat(4 - remainder)}`

  try {
    const binary = atob(complete)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return bytes
  } catch {
    return null
  }
}

function crc16Xmodem(data: Uint8Array): Uint8Array {
  let crc = 0

  for (const byte of data) {
    crc ^= byte << 8

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }

  return Uint8Array.of((crc >>> 8) & 0xff, crc & 0xff)
}
