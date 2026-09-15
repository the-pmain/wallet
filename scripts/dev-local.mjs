import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { isLocalSupabaseUrl } from './local-supabase-url.mjs'
import {
  listThemeDevServers,
  openBrowser,
  spawnThemeDevServer,
  waitFor,
} from './theme-dev-servers.mjs'

const ROOT = resolve('.')
const SUPABASE_CLI = resolve(ROOT, 'node_modules/supabase/dist/supabase.js')
const API_HEALTH = 'http://127.0.0.1:8080/v1/health'
const dbOnly = process.argv.includes('--db-only')
const themeServers = listThemeDevServers()

const children = []

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) {
      child.kill(signal)
    }
  })
}

await ensureLocalDatabase()
writeLocalEnv()

if (dbOnly) {
  console.log(
    'Local database is ready. Start the app with `npm run local` or `npm run server:dev` and `npm run dev`.',
  )
  process.exit(0)
}

if (!(await isUp(API_HEALTH))) {
  console.log('Starting the local Node API on http://127.0.0.1:8080')
  children.push(trackChild(spawnNpm('server:dev', withThemeOrigins(process.env, themeServers))))
}

for (const server of themeServers) {
  if (!(await isUp(server.probes))) {
    console.log(`Starting ${server.theme} on ${server.url}`)
    children.push(trackChild(spawnThemeDevServer(server.theme, server.port)))
  }
}

if (!(await waitFor(API_HEALTH, 60_000))) {
  console.error('The Node API did not start on http://127.0.0.1:8080')
  process.exit(1)
}

for (const server of themeServers) {
  if (!(await waitFor(server.probes, 60_000))) {
    console.error(`${server.theme} did not start on ${server.url}`)
    process.exit(1)
  }
}

await assertApiUsesLocalSupabase()

for (const server of themeServers) {
  openBrowser(server.url)
}

console.log(
  [
    'Local stack is up:',
    ...themeServers.map((server) => `  Wallet  ${server.theme}  ${server.url}`),
    '  API     http://127.0.0.1:8080',
    '  Studio  http://127.0.0.1:55323',
  ].join('\n'),
)

if (children.length === 0) {
  process.exit(0)
}

function supabase(args) {
  return spawnSync(process.execPath, [SUPABASE_CLI, '--agent', 'no', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  })
}

async function ensureLocalDatabase() {
  const status = supabase(['status', '-o', 'env'])
  const apiUrl = readStatusValue(status.stdout ?? '', 'API_URL')

  if (status.status === 0 && isLocalSupabaseUrl(apiUrl)) {
    return
  }

  console.log('Starting local Supabase (Docker). This does not touch a hosted project.')
  const started = supabase(['start'])

  if (started.status !== 0) {
    console.error('Local Supabase failed to start. Is Docker running?')
    process.exit(started.status ?? 1)
  }
}

function writeLocalEnv() {
  const written = spawnSync(
    process.execPath,
    [resolve(ROOT, 'scripts/write-local-supabase-env.mjs')],
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
    },
  )

  if (written.status !== 0) {
    process.exit(written.status ?? 1)
  }
}

function spawnNpm(script, env = process.env) {
  return spawn('npm', ['run', script], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env,
  })
}

function withThemeOrigins(env, servers) {
  const existing = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
  const extra = servers.flatMap((server) => [
    `http://127.0.0.1:${server.port}`,
    `http://localhost:${server.port}`,
  ])

  return { ...env, ALLOWED_ORIGINS: [...new Set([...existing, ...extra])].join(',') }
}

function trackChild(child) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code
    }
  })

  return child
}

async function isUp(urlOrUrls) {
  return waitFor(urlOrUrls, 1_200)
}

async function assertApiUsesLocalSupabase() {
  const response = await fetch(API_HEALTH)
  const body = await response.json().catch(() => null)

  if (response.status !== 200 || body?.users !== 'supabase') {
    console.error(
      'The Node process is not using the local Supabase store. ' +
        'Stop any old `npm run server:dev` and run `npm run local` again.',
    )
    process.exit(1)
  }
}

function readStatusValue(raw, key) {
  const fromEnv = parseEnv(raw)[key]
  if (typeof fromEnv === 'string' && fromEnv !== '') {
    return fromEnv
  }

  try {
    const parsed = JSON.parse(raw)
    return typeof parsed[key] === 'string' ? parsed[key] : ''
  } catch {
    return ''
  }
}

function parseEnv(raw) {
  const values = {}

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    const separator = trimmed.indexOf('=')
    if (separator <= 0) {
      continue
    }

    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim()
  }

  return values
}
