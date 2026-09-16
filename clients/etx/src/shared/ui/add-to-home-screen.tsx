import { Share, Smartphone, SquarePlus } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  isIosDevice,
  isHomeScreenInstalled,
  promptHomeScreenInstall,
  startHomeScreenInstallListener,
  subscribeHomeScreenInstall,
  getDeferredInstallPrompt,
} from '@/shared/lib/home-screen'

import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Dialog } from './dialog'

export type AddToHomeScreenVariant = 'card' | 'link' | 'square'

interface AddToHomeScreenProps {
  readonly variant: AddToHomeScreenVariant
}

/**
 * Просит владельца поставить кошелёк на домашний экран телефона.
 *
 * ANDROID CHROME ПОЛУЧАЕТ СИСТЕМНЫЙ ДИАЛОГ, если браузер его предложил.
 * Остальные — в первую очередь iPhone — получают пронумерованные шаги.
 * Сайт не может поставить иконку сам на iOS; изображать, что кнопка
 * это сделает, было бы ложью.
 *
 * В STANDALONE СКРЫТА. Страница уже открыта как приложение с
 * домашнего экрана. Карточка в настройках остаётся и говорит об
 * этом, чтобы владелец не искал пропавший орган управления.
 */
export function AddToHomeScreen({ variant }: AddToHomeScreenProps) {
  const [, setRevision] = useState(0)
  const [isGuideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    startHomeScreenInstallListener()

    return subscribeHomeScreenInstall(() => {
      setRevision((value) => value + 1)
    })
  }, [])

  const isInstalled = isHomeScreenInstalled()
  const showIosSteps = isIosDevice()

  if (isInstalled && variant !== 'card') {
    return null
  }

  const handleClick = () => {
    if (getDeferredInstallPrompt() === null) {
      setGuideOpen(true)
      return
    }

    void promptHomeScreenInstall().then((result) => {
      if (result === 'unavailable') {
        setGuideOpen(true)
      }
    })
  }

  const guide = (
    <Dialog
      isOpen={isGuideOpen}
      onClose={() => {
        setGuideOpen(false)
      }}
      title="Add to Home Screen"
      description={
        showIosSteps
          ? 'iPhone and iPad do not let a site add the icon itself. Use the Share menu in Safari:'
          : 'Your browser adds the shortcut from its own menu:'
      }
      footer={
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setGuideOpen(false)
          }}
        >
          Close
        </Button>
      }
    >
      {showIosSteps ? <IosSteps /> : <BrowserMenuSteps />}
    </Dialog>
  )

  if (variant === 'card') {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">
              Home screen
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isInstalled ? (
              <p className="text-sm text-muted-foreground">
                This device already has the shortcut. Open the wallet from the icon on your home
                screen.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Put a shortcut on this phone so the wallet opens like an app, without the browser
                  chrome.
                </p>
                <Button type="button" variant="outline" className="w-full" onClick={handleClick}>
                  <Smartphone className="size-4" aria-hidden />
                  Add to Home Screen
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        {guide}
      </>
    )
  }

  if (variant === 'square') {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-xl border-border/80 bg-card/80 shadow-surface backdrop-blur-sm"
          aria-label="Add to Home Screen"
          onClick={handleClick}
        >
          <SquarePlus className="size-5" aria-hidden />
        </Button>
        {guide}
      </>
    )
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={handleClick}>
        <Smartphone className="size-4" aria-hidden />
        Add to Home Screen
      </Button>
      {guide}
    </>
  )
}

function IosSteps() {
  return (
    <ol className="flex list-decimal flex-col gap-2.5 ps-5 text-sm leading-relaxed">
      <li>
        Tap Share
        <Share className="mx-1 inline size-3.5 align-text-bottom" aria-hidden />
        (the square with the arrow pointing up).
      </li>
      <li>Scroll and tap Add to Home Screen.</li>
      <li>Tap Add.</li>
    </ol>
  )
}

function BrowserMenuSteps() {
  return (
    <ol className="flex list-decimal flex-col gap-2.5 ps-5 text-sm leading-relaxed">
      <li>Open the browser menu (the three dots).</li>
      <li>Tap Add to Home screen or Install app.</li>
      <li>Confirm.</li>
    </ol>
  )
}
