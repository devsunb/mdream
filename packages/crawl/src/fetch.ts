import type { MdreamConvertOptions } from './types.js'
import { htmlToMarkdown } from 'mdream'
import { ofetch } from 'ofetch'
import { withHttps } from 'ufo'
import { loadMdreamConfig } from './config.js'

export async function fetchHttp(url: string, timeoutSec: number): Promise<string> {
  return await ofetch<string, 'text'>(url, {
    timeout: timeoutSec * 1000,
    responseType: 'text',
    retry: 0,
  })
}

export function convertToMarkdown(
  html: string,
  origin: string,
  mdreamOpts: MdreamConvertOptions | undefined,
): string {
  return htmlToMarkdown(html, { ...mdreamOpts, origin } as Record<string, unknown>)
}

export interface FetchArgs {
  url: string
  driver: 'http' | 'playwright'
  origin?: string
  timeout: number
  configFile?: string
  verbose: boolean
}

export class ParseError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'ParseError'
  }
}

const HELP_TEXT = `Usage: mdream-crawl fetch <url> [options]

Fetch a single URL and print clean Markdown to stdout.

Options:
  --driver <http|playwright>   Rendering engine (default: http)
  --origin <url>               Origin for resolving relative paths (default: inferred)
  --timeout <seconds>          Fetch timeout (default: 30)
  -c, --config <path>          Path to mdream.config.ts
  -v, --verbose                Log progress to stderr
  -h, --help                   Show this help
`

export function parseArgs(argv: string[]): FetchArgs {
  let url: string | undefined
  let driver: 'http' | 'playwright' = 'http'
  let origin: string | undefined
  let timeout = 30
  let configFile: string | undefined
  let verbose = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--driver') {
      const v = argv[++i]
      if (v !== 'http' && v !== 'playwright')
        throw new ParseError(`Invalid driver "${v}" (expected http|playwright)`)
      driver = v
    }
    else if (a === '--origin') {
      origin = argv[++i]
    }
    else if (a === '--timeout') {
      const raw = argv[++i]
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0)
        throw new ParseError(`Invalid timeout "${raw}" (expected positive number)`)
      timeout = n
    }
    else if (a === '-c' || a === '--config') {
      configFile = argv[++i]
    }
    else if (a === '-v' || a === '--verbose') {
      verbose = true
    }
    else if (a === '-h' || a === '--help') {
      process.stdout.write(HELP_TEXT)
      process.exit(0)
    }
    else if (!a.startsWith('-') && !url) {
      url = a
    }
    else {
      throw new ParseError(`Unknown argument: ${a}`)
    }
  }

  if (!url)
    throw new ParseError('URL is required. Usage: mdream-crawl fetch <url>')
  return { url, driver, origin, timeout, configFile, verbose }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv)
  const url = withHttps(args.url)
  const origin = args.origin ?? new URL(url).origin

  const config = args.configFile
    ? await loadMdreamConfig(undefined, args.configFile)
    : {}

  if (args.verbose)
    process.stderr.write(`Fetching ${url} via ${args.driver}...\n`)

  const html = args.driver === 'playwright'
    ? await fetchPlaywright(url, args.timeout)
    : await fetchHttp(url, args.timeout)

  if (args.verbose)
    process.stderr.write(`Converting (${html.length} bytes)...\n`)

  const md = convertToMarkdown(html, origin, config.mdream)
  process.stdout.write(md)
}

export async function fetchPlaywright(url: string, timeoutSec: number): Promise<string> {
  let chromium: typeof import('playwright').chromium
  try {
    ({ chromium } = await import('playwright'))
  }
  catch {
    process.stderr.write('Error: playwright is not installed. Run: npm install playwright\n')
    process.exit(1)
  }
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutSec * 1000 })
    return await page.content()
  }
  finally {
    await browser.close()
  }
}
