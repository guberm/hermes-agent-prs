import { beforeEach, describe, expect, it } from 'vitest'

import type { HermesConnection } from '@/global'

import {
  $connection,
  getRememberedRoute,
  getRememberedSessionId,
  setRememberedRoute,
  setRememberedSessionId
} from './session'

/** A registered remote reached through a LOCAL FORWARD: the registry connection
 *  is stable (`legion`), the URL's port is not — it is re-minted every time the
 *  tunnel/backend comes up. */
const remote = (port: string) =>
  ({
    baseUrl: `http://127.0.0.1:${port}`,
    connectionId: 'legion',
    mode: 'remote',
    profile: 'default'
  }) as unknown as HermesConnection

beforeEach(() => {
  window.localStorage.clear()
  $connection.set(remote('18498'))
})

describe('remembered navigation is scoped by the stable connection', () => {
  it('reads back the chat and route after the remote port moves', () => {
    setRememberedSessionId('chat-a', 'default')
    setRememberedRoute('/session/chat-a', 'default')

    // Next launch: same registry connection, new local-forward port.
    $connection.set(remote('20111'))

    expect(getRememberedSessionId('default')).toBe('chat-a')
    expect(getRememberedRoute('default')).toBe('/session/chat-a')
  })

  it('keeps two gateways apart', () => {
    setRememberedSessionId('chat-a', 'default')

    $connection.set({ ...remote('20111'), connectionId: 'other' } as unknown as HermesConnection)

    expect(getRememberedSessionId('default')).toBeNull()
  })
})
