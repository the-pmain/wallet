const COINBASE_SPOT_URL = 'https://api.coinbase.com/v2/prices'
const REQUEST_TIMEOUT_MS = 10_000

/** Известные стейблкоины. Курс берётся только если список рынка не загрузился. */
const FALLBACK_STABLES = [
  { id: 'usd-coin', symbol: 'USDC', name: 'USDC', product: 'USDC-USD' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', product: 'USDT-USD' },
  { id: 'dai', symbol: 'DAI', name: 'Dai', product: 'DAI-USD' },
] as const

export interface ICoinbaseStablePrice {
  readonly id: string
  readonly symbol: string
  readonly name: string
  readonly priceUsd: number
}

/**
 * Курс ETH/USD с Coinbase.
 *
 * Запасной источник, если единственный запрос к CoinGecko не прошёл:
 * бесплатный лимит там кончается на нескольких обращениях подряд.
 */
export async function fetchCoinbaseEthUsd(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<number | null> {
  return fetchCoinbaseSpotUsd('ETH-USD', fetchImpl)
}

/**
 * Спотовые курсы стейблкоинов, которые витрина уже умеет узнавать.
 *
 * Только после отказа `/coins/markets`. Пары публичные и не называют
 * кошелёк. Нет пары — монеты нет в оценке, единица не подставляется.
 */
export async function fetchCoinbaseStableUsd(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<readonly ICoinbaseStablePrice[]> {
  const priced = await Promise.all(
    FALLBACK_STABLES.map(async (stable) => {
      const priceUsd = await fetchCoinbaseSpotUsd(stable.product, fetchImpl)

      return priceUsd === null
        ? null
        : { id: stable.id, symbol: stable.symbol, name: stable.name, priceUsd }
    }),
  )

  return priced.filter((entry) => entry !== null)
}

async function fetchCoinbaseSpotUsd(
  product: string,
  fetchImpl: typeof fetch,
): Promise<number | null> {
  try {
    const response = await fetchImpl(`${COINBASE_SPOT_URL}/${product}/spot`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })

    if (!response.ok) {
      return null
    }

    const payload: unknown = await response.json()

    if (payload === null || typeof payload !== 'object') {
      return null
    }

    const data = (payload as Record<string, unknown>)['data']

    if (data === null || typeof data !== 'object') {
      return null
    }

    const amount = (data as Record<string, unknown>)['amount']

    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
      return amount
    }

    if (typeof amount === 'string') {
      const parsed = Number(amount)

      return Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }

    return null
  } catch {
    return null
  }
}
