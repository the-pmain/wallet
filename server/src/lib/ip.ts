import { isIP } from 'node:net'

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu

/**
 * Strips brackets and IPv4-mapped IPv6 so `::ffff:1.2.3.4`
 * compares equal to `1.2.3.4`.
 */
export function normalizeIp(value: string): string {
  let ip = value.trim()

  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1)
  }

  const mapped = IPV4_MAPPED.exec(ip)

  if (mapped?.[1] !== undefined && isIP(mapped[1]) === 4) {
    return mapped[1]
  }

  if (isIP(ip) === 6) {
    return ip.toLowerCase()
  }

  return ip
}

/** True for a single IPv4 or IPv6 address, not a hostname or CIDR. */
export function isValidIp(value: string): boolean {
  const ip = normalizeIp(value)

  return isIP(ip) === 4 || isIP(ip) === 6
}
