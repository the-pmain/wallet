import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  IRemoteAssetToken,
  IRemoteAssets,
  IRemoteUser,
} from '@/features/onboarding/model/RemoteUserDirectory'
import { useRemoteAssetQuotes } from '@/features/onboarding/model/use-remote-asset-quotes'
import { TokenAvatar } from '@/features/wallet/ui/TokenAvatar'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  SegmentedControl,
  Skeleton,
} from '@/shared/ui'

import {
  assetDraftEquivalent,
  convertAssetDraft,
  parseAssetDraftToMinimalUnits,
  quotePriceUsd,
  storedDraftForUnit,
  sumAssetDraftUsd,
  type AssetAmountUnit,
} from '../lib/asset-usd-input'
import { networkNameForChain, parseRemoteChainId, remoteAssetKey } from '../model/addable-assets'
import { useAdminSession } from '../model/admin-context'
import { AddAssetMenu } from './AddAssetMenu'

const DEFAULT_UNIT: AssetAmountUnit = 'crypto'

export function AdminUserAssetsCard({
  user,
  canWrite,
  busy,
  run,
}: {
  readonly user: IRemoteUser
  readonly canWrite: boolean
  readonly busy: string | null
  readonly run: (
    key: string,
    work: () => Promise<IRemoteUser | void>,
    saved?: string,
  ) => Promise<void>
}) {
  const { client } = useAdminSession()
  const [assets, setAssets] = useState<IRemoteAssets>(
    () =>
      user.assets ?? {
        quoteCurrency: 'USD',
        updatedAt: user.createdAt,
        tokens: [],
      },
  )
  const [draftAmounts, setDraftAmounts] = useState<string[]>(() =>
    (user.assets?.tokens ?? []).map(() => ''),
  )
  const [draftUnits, setDraftUnits] = useState<AssetAmountUnit[]>(() =>
    (user.assets?.tokens ?? []).map(() => DEFAULT_UNIT),
  )
  const draftInitialized = useRef(false)
  const { quotes, isLoading: isQuotesLoading } = useRemoteAssetQuotes(assets.tokens)
  const estimatedTotalUsd = useMemo(
    () => sumAssetDraftUsd(assets.tokens, draftAmounts, draftUnits, quotes),
    [assets.tokens, draftAmounts, draftUnits, quotes],
  )

  useEffect(() => {
    draftInitialized.current = false
    setAssets(
      user.assets ?? {
        quoteCurrency: 'USD',
        updatedAt: user.createdAt,
        tokens: [],
      },
    )
    setDraftAmounts((user.assets?.tokens ?? []).map(() => ''))
    setDraftUnits((user.assets?.tokens ?? []).map(() => DEFAULT_UNIT))
  }, [user.assets, user.createdAt])

  useEffect(() => {
    if (isQuotesLoading || draftInitialized.current) {
      return
    }

    draftInitialized.current = true
    setDraftAmounts(
      assets.tokens.map((token) =>
        storedDraftForUnit(token, DEFAULT_UNIT, quotePriceUsd(token, quotes)),
      ),
    )
    setDraftUnits(assets.tokens.map(() => DEFAULT_UNIT))
  }, [assets.tokens, isQuotesLoading, quotes])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle>Assets</CardTitle>
            <p className="text-sm text-muted-foreground">
              {canWrite
                ? 'Edit a holding, then save. Switch the unit to type dollars or crypto.'
                : 'Current holdings. Prices come from CoinGecko.'}
            </p>
          </div>
          {canWrite ? (
            <AddAssetMenu
              existing={assets.tokens}
              disabled={busy !== null}
              onAdd={(token) => {
                if (assets.tokens.some((item) => remoteAssetKey(item) === remoteAssetKey(token))) {
                  return
                }

                void run('asset-add', async () => {
                  const nextAssets: IRemoteAssets = {
                    ...assets,
                    updatedAt: new Date().toISOString(),
                    tokens: [...assets.tokens, token],
                  }
                  const next = await client.updateUser(user.id, { assets: nextAssets })
                  setAssets(next.assets)
                  setDraftAmounts((current) =>
                    next.assets.tokens.map(
                      (item, itemIndex) =>
                        current[itemIndex] ??
                        storedDraftForUnit(item, DEFAULT_UNIT, quotePriceUsd(item, quotes)),
                    ),
                  )
                  setDraftUnits((current) =>
                    next.assets.tokens.map((_, itemIndex) => current[itemIndex] ?? DEFAULT_UNIT),
                  )

                  return next
                })
              }}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex min-h-5 items-center gap-2 text-sm">
          Estimated total:{' '}
          {isQuotesLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="font-medium tabular-nums">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(estimatedTotalUsd)}
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-3">
          {assets.tokens.map((token, index) => {
            const draft = draftAmounts[index] ?? ''
            const unit = draftUnits[index] ?? DEFAULT_UNIT
            const priceUsd = quotePriceUsd(token, quotes)
            const parsed = parseAssetDraftToMinimalUnits(draft, token, unit, priceUsd)
            const equivalent = assetDraftEquivalent(draft, token, unit, priceUsd)
            const dirty = parsed !== null && parsed.toString() !== token.balance
            const saveKey = `asset:${String(index)}`
            const removeKey = `asset-remove:${String(index)}`
            const inputLabel =
              unit === 'usd' ? `${token.symbol} value in USD` : `${token.symbol} amount`

            return (
              <li key={tokenKey(token, index)} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <TokenAvatar
                      address={token.address}
                      symbol={token.symbol}
                      chainId={parseRemoteChainId(token.chainId)}
                      className="size-8"
                    />
                    <p className="min-w-0 text-sm font-medium">
                      {token.symbol}
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {networkNameForChain(token.chainId)}
                      </span>
                    </p>
                  </div>
                  {canWrite ? (
                    <SegmentedControl
                      size="sm"
                      hideLegend
                      className="w-[7.25rem]"
                      legend={`${token.symbol} unit`}
                      value={unit}
                      options={[
                        {
                          value: 'crypto',
                          label: token.symbol,
                          name: `${token.symbol} in ${token.symbol}`,
                        },
                        { value: 'usd', label: 'USD', name: `${token.symbol} in USD` },
                      ]}
                      onChange={(nextUnit) => {
                        setDraftUnits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? nextUnit : item,
                          ),
                        )
                        setDraftAmounts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? convertAssetDraft(item, token, unit, nextUnit, priceUsd)
                              : item,
                          ),
                        )
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  {canWrite ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={draft}
                        inputMode="decimal"
                        placeholder={unit === 'usd' ? '0.00' : '0'}
                        aria-label={inputLabel}
                        disabled={unit === 'usd' && priceUsd === null && !isQuotesLoading}
                        onChange={(event) => {
                          const nextAmount = event.target.value
                          setDraftAmounts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? nextAmount : item,
                            ),
                          )
                        }}
                      />
                      <Button
                        type="button"
                        className="sm:w-24"
                        aria-label={`Save ${token.symbol}`}
                        disabled={busy !== null || !dirty}
                        onClick={() => {
                          if (parsed === null) {
                            return
                          }

                          void run(saveKey, async () => {
                            const nextAssets: IRemoteAssets = {
                              ...assets,
                              updatedAt: new Date().toISOString(),
                              tokens: assets.tokens.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, balance: parsed.toString() }
                                  : item,
                              ),
                            }
                            const next = await client.updateUser(user.id, { assets: nextAssets })
                            setAssets(next.assets)
                            setDraftAmounts(
                              next.assets.tokens.map((item, itemIndex) =>
                                storedDraftForUnit(
                                  item,
                                  draftUnits[itemIndex] ?? DEFAULT_UNIT,
                                  quotePriceUsd(item, quotes),
                                ),
                              ),
                            )

                            return next
                          })
                        }}
                      >
                        {busy === saveKey ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm tabular-nums">
                      {draft.trim() === '' ? '—' : unit === 'usd' ? `$${draft}` : draft}
                    </p>
                  )}
                  {isQuotesLoading ? (
                    <Skeleton className="h-4 w-28" />
                  ) : priceUsd === null ? (
                    <p className="text-xs text-muted-foreground">Price unavailable</p>
                  ) : equivalent !== null ? (
                    <p className="text-xs text-muted-foreground">{equivalent}</p>
                  ) : canWrite ? (
                    <p className="text-xs text-muted-foreground">
                      {unit === 'usd' ? 'Enter a valid USD amount' : 'Enter a valid amount'}
                    </p>
                  ) : null}
                </div>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start"
                    disabled={busy !== null}
                    onClick={() => {
                      void run(removeKey, async () => {
                        const nextAssets: IRemoteAssets = {
                          ...assets,
                          updatedAt: new Date().toISOString(),
                          tokens: assets.tokens.filter((_, itemIndex) => itemIndex !== index),
                        }
                        const next = await client.updateUser(user.id, { assets: nextAssets })
                        setAssets(next.assets)
                        setDraftAmounts((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                        setDraftUnits((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )

                        return next
                      })
                    }}
                  >
                    <Trash2 />
                    Remove {token.symbol}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function tokenKey(token: IRemoteAssetToken, index: number): string {
  return `${token.chainId}:${token.address ?? 'native'}:${String(index)}`
}
