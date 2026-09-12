import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { loadLocalEnv } from './load-env.ts'
import { createActivityRequestsStore } from './activity-requests/createActivityRequestsStore.ts'
import { createLoginEventsStore } from './login-events/createLoginEventsStore.ts'
import { createReceivingsStore } from './receivings/createReceivingsStore.ts'
import { createSendingsStore } from './sendings/createSendingsStore.ts'
import { createUsersStore } from './users/createUsersStore.ts'

loadLocalEnv()

/**
 * Node process entry.
 *
 * Same repository as the wallet UI: `npm start` from the root raises
 * Fastify, which serves `/v1` and the built UI from `dist/`.
 *
 * A CONFIG OR CATALOG ERROR STOPS STARTUP. A service that came up
 * with a corrupt catalog serves wrong contract addresses to every
 * user at once; a startup refusal is seen immediately by whoever
 * deploys the service.
 */
async function main(): Promise<void> {
  const config = loadConfig()
  const usersStore = createUsersStore(config)
  const sendingsStore = await createSendingsStore(config)
  const receivingsStore = await createReceivingsStore(config)
  const loginEventsStore = await createLoginEventsStore(config)
  const activityRequestsStore = await createActivityRequestsStore(config)
  const app = await buildApp({
    config,
    users: usersStore.users,
    usersKind: usersStore.kind,
    sendings: sendingsStore.sendings,
    sendingsStorageWarning: sendingsStore.storageWarning,
    receivings: receivingsStore.receivings,
    receivingsStorageWarning: receivingsStore.storageWarning,
    loginEvents: loginEventsStore.loginEvents,
    activityRequests: activityRequestsStore.activityRequests,
  })

  app.addHook('onClose', async () => {
    await usersStore.close()
    await sendingsStore.close()
    await receivingsStore.close()
    await loginEventsStore.close()
    await activityRequestsStore.close()
  })

  /* A signal stop closes connections instead of cutting them:
     a request started before the signal must finish. */
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'Stopping the service')

      void app.close().then(
        () => {
          process.exit(0)
        },
        (error: unknown) => {
          app.log.error({ err: error }, 'Error while stopping')
          process.exit(1)
        },
      )
    })
  }

  await app.listen({ host: config.host, port: config.port })

  if (config.staticRoot !== null) {
    app.log.info({ staticRoot: config.staticRoot }, 'Wallet interface')
  }
}

main().catch((error: unknown) => {
  /* The logger is not up yet: nowhere to write but stderr. */
  console.error('The service did not start:', error)
  process.exit(1)
})
