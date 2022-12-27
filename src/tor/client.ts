import { readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { Tor } from 'tor-control-ts'

import { createLogger } from '../factories/logger-factory'
import { TorConfig } from '../@types/tor'


const debug = createLogger('tor-client')

const getPrivateKeyFile = () => {
  return join(
    process.env.NOSTR_CONFIG_DIR ?? join(homedir(), '.nostr'),
    'v3_onion_private_key'
  )
}

const createTorConfig = (): TorConfig => {
  return {
    host: process.env.TOR_HOST,
    port: process.env.TOR_CONTROL_PORT ? Number(process.env.TOR_CONTROL_PORT) : 9051,
    password: process.env.TOR_PASSWORD,
  }
}

let client: Tor | undefined

export const getTorClient = async () => {
  if (!client) {
    const config = createTorConfig()
    debug('config: %o', config)

    if (config.port) {
      debug('connecting')
      client = new Tor(config)
      await client.connect()
      debug('connected')
    }
  }

  return client
}

export const addOnion = async (
  port: number,
  host?: string
): Promise<string> => {
  let privateKey = null
  const path = getPrivateKeyFile()

  try {
    debug('reading private key from %s', path)
    const data = await readFile(path, 'utf8')
    if (data?.length) {
      privateKey = data
      debug('privateKey: %o', privateKey)
    }
  } catch (error) {
    debug('error reading private key: %o', error)
  }

  try {
    const client = await getTorClient()
    if (!client) {
      return
    }
    if (client) {
      const hiddenService = await client.addOnion(port, host, privateKey)
      debug('hidden service: %s:%d', hiddenService.ServiceID, port)

      if (hiddenService?.PrivateKey) {
        debug('saving private key to %s', path)

        await writeFile(path, hiddenService.PrivateKey, 'utf8')
      }

      return hiddenService.ServiceID
    }
  } catch (error) {
    console.error('error adding onion: %o', error)
  }
}