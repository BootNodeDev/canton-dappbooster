import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2'

// Wire pure-JS SHA-512 so we don't depend on crypto.subtle for non-secure origins.
const sha512Bytes = (msg: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(64)
  out.set(sha512(msg))
  return out
}
ed.hashes.sha512 = sha512Bytes
ed.hashes.sha512Async = async (msg) => sha512Bytes(msg)

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

export const fromHex = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) {
    throw new Error('invalid hex')
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) {
      throw new Error('invalid hex')
    }
    out[i] = byte
  }
  return out
}

export const toBase64 = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) {
    s += String.fromCharCode(b)
  }
  return btoa(s)
}

export const fromBase64 = (b64: string): Uint8Array => {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    out[i] = s.charCodeAt(i)
  }
  return out
}

export interface GeneratedKeypair {
  privateKeyHex: string
  publicKeyBase64: string
}

export const generateKeypair = async (): Promise<GeneratedKeypair> => {
  const privateKey = ed.utils.randomSecretKey()
  const publicKey = await ed.getPublicKeyAsync(privateKey)
  return {
    privateKeyHex: toHex(privateKey),
    publicKeyBase64: toBase64(publicKey),
  }
}

// Derives the public account key required by provider payloads from an imported secret key.
export const derivePublicKeyBase64 = async (privateKeyHex: string): Promise<string> => {
  try {
    const publicKey = await ed.getPublicKeyAsync(fromHex(privateKeyHex.trim()))
    return toBase64(publicKey)
  } catch {
    throw new Error('invalid private key')
  }
}

export const signMessageBase64 = async (
  privateKeyHex: string,
  messageBase64: string,
): Promise<string> => {
  const sig = await ed.signAsync(fromBase64(messageBase64), fromHex(privateKeyHex))
  return toBase64(sig)
}
