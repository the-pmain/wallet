import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIRST_PORT = 3000
const VITE_CLI = resolve(ROOT, 'node_modules/vite/bin/vite.js')

/**
 * One Vite process per registered theme.
 *
 * Ports follow registry order: the first theme is 3000, the next is
 * 3001, and so on. Production build and `vite preview` do not use this
 * list — they still resolve a single `THEME` from the environment.
 */
export function listThemeDevServers() {
  const themes = Object.keys(
    JSON.parse(readFileSync(resolve(ROOT, 'build/themes.json'), { encoding: 'utf8' })),
  )

  return themes.map((theme, index) => {
    const port = FIRST_PORT + index

    return {
      theme,
      port,
      url: `http://localhost:${port}`,
      probes: [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`],
    }
  })
}

export function spawnThemeDevServer(theme, port, extraArgs = []) {
  return spawn(process.execPath, [VITE_CLI, '--port', String(port), '--strictPort', ...extraArgs], {
    cwd: ROOT,
    env: { ...process.env, THEME: theme, DEV_CLIENT_PORT: String(port) },
    stdio: 'inherit',
  })
}

export async function waitFor(urlOrUrls, timeoutMs) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls]
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    for (const url of urls) {
      try {
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(800) })
        if (response.ok || response.status === 304) {
          return true
        }
      } catch {
        /* try the next address */
      }
    }

    await sleep(400)
  }

  return false
}

export function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
      : spawn('open', [url], { detached: true, stdio: 'ignore' })

  command.unref()
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms)
  })
}
