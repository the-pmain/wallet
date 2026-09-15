import {
  listThemeDevServers,
  openBrowser,
  spawnThemeDevServer,
  waitFor,
} from './theme-dev-servers.mjs'

const extraArgs = process.argv.slice(2)
const servers = listThemeDevServers()
const children = []

if (servers.length === 0) {
  throw new Error('build/themes.json has no themes to start.')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) {
      child.kill(signal)
    }
  })
}

for (const server of servers) {
  console.log(`Starting ${server.theme} on ${server.url}`)

  const child = spawnThemeDevServer(server.theme, server.port, extraArgs)

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code
    }
  })

  children.push(child)
}

for (const server of servers) {
  if (!(await waitFor(server.probes, 60_000))) {
    console.error(`${server.theme} did not start on ${server.url}`)
    process.exit(1)
  }

  openBrowser(server.url)
}

console.log(
  ['Dev servers:', ...servers.map((server) => `  ${server.theme}  ${server.url}`)].join('\n'),
)
