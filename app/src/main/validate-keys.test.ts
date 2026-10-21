import { describe, expect, it, vi } from 'vitest'
import { validateKey } from './validate-keys'

const respond = (status: number) => vi.fn(async () => new Response('{}', { status }))

describe('validateKey', () => {
  it('checks each provider with one authenticated GET', async () => {
    const fetchMock = respond(200)
    await validateKey('deepgram', 'dg', fetchMock)
    await validateKey('gemini', 'gm', fetchMock)
    await validateKey('groq', 'gq', fetchMock)
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(calls.map(([url]) => new URL(url).host)).toEqual([
      'api.deepgram.com',
      'generativelanguage.googleapis.com',
      'api.groq.com'
    ])
    expect(calls[0][1].headers).toMatchObject({ authorization: 'Token dg' })
    expect(calls[1][1].headers).toMatchObject({ 'x-goog-api-key': 'gm' })
    expect(calls[2][1].headers).toMatchObject({ authorization: 'Bearer gq' })
    for (const [url, init] of calls) {
      expect(init.method ?? 'GET').toBe('GET')
      expect(url).not.toMatch(/dg|gm|gq/) // keys never go in the URL
    }
  })

  it('accepts a working key', async () => {
    expect(await validateKey('groq', 'k', respond(200))).toEqual({ ok: true })
  })

  it('rejects a key the provider refuses, naming the provider', async () => {
    expect(await validateKey('groq', 'k', respond(401))).toEqual({ ok: false, message: 'Groq rejected this key (401).' })
    // Google answers an invalid key with 400.
    expect(await validateKey('gemini', 'k', respond(400))).toEqual({ ok: false, message: 'Google rejected this key (400).' })
    expect(await validateKey('deepgram', 'k', respond(403))).toEqual({ ok: false, message: 'Deepgram rejected this key (403).' })
  })

  it('saves anyway, with a warning, when the provider cannot be reached or is having trouble', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await validateKey('gemini', 'k', offline)).toMatchObject({ ok: true, warning: expect.stringMatching(/couldn.t check/i) })
    expect(await validateKey('gemini', 'k', respond(503))).toMatchObject({ ok: true, warning: expect.any(String) })
  })

  it('does not call out for keys it has no check for', async () => {
    const fetchMock = respond(200)
    expect(await validateKey('anthropic', 'k', fetchMock)).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
