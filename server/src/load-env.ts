import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Reads env files without overwriting variables already set in the process,
 * except `*.local` files which override `SUPABASE_*` so a hosted project URL
 * injected into the shell cannot beat the local stack.
 *
 * Order: `.env`, `server/.env`, then `.env.local` and `server/.env.local`.
 */
export function loadLocalEnv(root: string = repositoryRoot()): void {
  const preset = new Set(Object.keys(process.env))

  applyEnvFile(join(root, '.env'), process.env, preset, false)
  applyEnvFile(join(root, 'server/.env'), process.env, preset, false)
  applyEnvFile(join(root, '.env.local'), process.env, new Set(), true)
  applyEnvFile(join(root, 'server/.env.local'), process.env, new Set(), true)
}

export function applyEnvFile(
  path: string,
  env: NodeJS.ProcessEnv,
  preset: ReadonlySet<string>,
  overrideFileValues: boolean,
): void {
  if (!existsSync(path)) {
    return
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim()

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    const separator = trimmed.indexOf('=')

    if (separator <= 0) {
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (preset.has(key)) {
      continue
    }

    if (env[key] === undefined || overrideFileValues) {
      env[key] = value
    }
  }
}

function repositoryRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../..')
}
