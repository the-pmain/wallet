import type { FastifyRequest } from 'fastify'

import { ForbiddenError, UnauthorizedError } from '../lib/errors.ts'
import { ADMIN_ROLE, resolveAdminRole, type AdminRole } from './pass.ts'

export function presentedAdminPass(request: FastifyRequest): string | null {
  const header = request.headers['x-admin-pass']
  const pass = Array.isArray(header) ? header[0] : header

  if (typeof pass !== 'string' || pass.trim() === '') {
    return null
  }

  return pass.trim()
}

export function requireAdminRole(request: FastifyRequest): AdminRole {
  const pass = presentedAdminPass(request)

  if (pass === null) {
    throw new UnauthorizedError('Invalid credentials.')
  }

  const role = resolveAdminRole(pass)

  if (role === null) {
    throw new UnauthorizedError('Invalid credentials.')
  }

  return role
}

export function requireSuperAdmin(request: FastifyRequest): void {
  if (requireAdminRole(request) !== ADMIN_ROLE.Super) {
    throw new ForbiddenError('Insufficient permissions.')
  }
}
