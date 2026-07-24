import assert from 'node:assert/strict'
import test from 'node:test'
import { MIN_PASSWORD_SCORE, parsePasswordScore } from '@/vault/passwordStrength'

test('parsePasswordScore accepts in-range integer scores', () => {
  assert.equal(parsePasswordScore('0'), 0)
  assert.equal(parsePasswordScore('3'), 3)
  assert.equal(parsePasswordScore('4'), 4)
})

test('parsePasswordScore falls back to 1 for missing, empty, or invalid values', () => {
  assert.equal(parsePasswordScore(undefined), 1)
  assert.equal(parsePasswordScore(''), 1)
  assert.equal(parsePasswordScore('   '), 1)
  assert.equal(parsePasswordScore('abc'), 1)
  assert.equal(parsePasswordScore('-1'), 1)
  assert.equal(parsePasswordScore('5'), 1)
  assert.equal(parsePasswordScore('2.5'), 1)
})

test('MIN_PASSWORD_SCORE defaults to 1 when VITE_MIN_PASSWORD_SCORE is unset', () => {
  assert.equal(MIN_PASSWORD_SCORE, 1)
})
