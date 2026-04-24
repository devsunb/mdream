import type { MdreamCrawlConfig } from './types.js'
import { loadConfig } from 'c12'

export async function loadMdreamConfig(cwd?: string, configFile?: string): Promise<MdreamCrawlConfig> {
  const { config } = await loadConfig<MdreamCrawlConfig>({
    name: 'mdream',
    cwd,
    ...(configFile ? { configFile } : {}),
  })
  return config || {}
}
