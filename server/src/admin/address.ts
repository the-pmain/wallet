import { RUNTIME_MODE, type RuntimeMode } from '../config.ts'
import { isValidIp, normalizeIp } from '../lib/ip.ts'

/**
 * Whether this peer may call `/v1/admin`.
 *
 * Loopback is always accepted: a browser on this machine
 * (`http://127.0.0.1:8080`) is not a remote client. Remote
 * peers still need a listed address.
 *
 * An empty list in development or test means no address check:
 * existing fixtures keep working. An empty list in production
 * refuses every non-loopback cabinet request — a silent
 * "any address" would let anyone who learns the PIN use it.
 */
export function isAdminAddressAllowed(
  ip: string,
  allowed: readonly string[],
  mode: RuntimeMode,
): boolean {
  const presented = normalizeIp(ip)

  if (isValidIp(presented) && isLoopbackIp(presented)) {
    return true
  }

  if (allowed.length === 0) {
    return mode !== RUNTIME_MODE.Production
  }

  if (!isValidIp(presented)) {
    return false
  }

  return allowed.some((address) => normalizeIp(address) === presented)
}

function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1'
}
