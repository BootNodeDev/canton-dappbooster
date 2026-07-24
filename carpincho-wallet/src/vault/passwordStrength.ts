import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import { useEffect, useState } from 'react'

// Intentionally low default: this is a developer wallet, so a missing or invalid
// VITE_MIN_PASSWORD_SCORE accepts "very guessable" passwords (zxcvbn 1). Set the
// env var higher for a security-conscious build.
const FALLBACK_PASSWORD_SCORE = 1

// zxcvbn scores run 0-4; anything missing, blank, or out of range falls back.
export const parsePasswordScore = (raw: unknown): number => {
  if (typeof raw !== 'string' || raw.trim() === '') return FALLBACK_PASSWORD_SCORE
  const score = Number(raw)
  return Number.isInteger(score) && score >= 0 && score <= 4 ? score : FALLBACK_PASSWORD_SCORE
}

export const MIN_PASSWORD_SCORE = parsePasswordScore(import.meta.env?.VITE_MIN_PASSWORD_SCORE)

let ready = false
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

const ensureLoaded = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = Promise.all([
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ])
      .then(([common, en]) => {
        zxcvbnOptions.setOptions({
          dictionary: { ...common.dictionary, ...en.dictionary },
          graphs: common.adjacencyGraphs,
          translations: en.translations,
        })
        ready = true
        for (const listener of listeners) listener()
      })
      .catch((err) => {
        console.error('Failed to load zxcvbn language packs', err)
        loadPromise = null
      })
  }
  return loadPromise
}

// Lets non-UI callers (e.g. vault setup) await the zxcvbn language packs before
// scoring, so strength enforcement at the boundary cannot pass on a stale score.
export const ensurePasswordStrengthReady = (): Promise<void> => ensureLoaded()

let lastScoredPassword: string | null = null
let lastScore = 0

export const scorePassword = (password: string): number => {
  if (password.length === 0 || !ready) return 0
  if (password === lastScoredPassword) return lastScore
  lastScore = zxcvbn(password).score
  lastScoredPassword = password
  return lastScore
}

export const isPasswordAcceptable = (password: string): boolean =>
  scorePassword(password) >= MIN_PASSWORD_SCORE

export const isConfirmMismatch = (password: string, confirm: string): boolean =>
  confirm.length > 0 && password !== confirm

export const isNewPasswordPairValid = (password: string, confirm: string): boolean =>
  isPasswordAcceptable(password) && password === confirm

export const usePasswordStrengthReady = (): boolean => {
  const [isReady, setReady] = useState(ready)
  useEffect(() => {
    if (ready) {
      if (!isReady) setReady(true)
      return
    }
    const listener = (): void => setReady(true)
    listeners.add(listener)
    void ensureLoaded()
    return () => {
      listeners.delete(listener)
    }
  }, [isReady])
  return isReady
}
