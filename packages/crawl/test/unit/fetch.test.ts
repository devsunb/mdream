import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertToMarkdown, fetchHttp, ParseError, parseArgs } from '../../src/fetch.ts'

vi.mock('ofetch', () => ({
  ofetch: vi.fn(),
}))

describe('parseArgs', () => {
  it('parses positional URL with defaults', () => {
    expect(parseArgs(['https://example.com'])).toMatchObject({
      url: 'https://example.com',
      driver: 'http',
      timeout: 30,
      verbose: false,
    })
  })

  it('parses --driver playwright', () => {
    expect(parseArgs(['https://example.com', '--driver', 'playwright']).driver).toBe('playwright')
  })

  it('parses --origin override', () => {
    expect(parseArgs(['https://example.com/a', '--origin', 'https://other.com']).origin).toBe('https://other.com')
  })

  it('parses --timeout', () => {
    expect(parseArgs(['https://example.com', '--timeout', '60']).timeout).toBe(60)
  })

  it('parses -c and -v shorthands', () => {
    const args = parseArgs(['https://example.com', '-c', 'my.config.ts', '-v'])
    expect(args.configFile).toBe('my.config.ts')
    expect(args.verbose).toBe(true)
  })

  it('throws on missing URL', () => {
    expect(() => parseArgs([])).toThrow(/URL is required/)
  })

  it('throws on invalid --driver', () => {
    expect(() => parseArgs(['https://example.com', '--driver', 'curl'])).toThrow(/driver/)
  })

  it('throws on unknown flag', () => {
    expect(() => parseArgs(['https://example.com', '--unknown'])).toThrow(/Unknown argument/)
  })

  it('throws ParseError (not plain Error) on bad input', () => {
    expect(() => parseArgs([])).toThrow(ParseError)
  })
})

describe('fetchHttp', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns response body as text', async () => {
    const { ofetch } = await import('ofetch')
    vi.mocked(ofetch).mockResolvedValue('<h1>hi</h1>')
    const html = await fetchHttp('https://example.com', 10)
    expect(html).toBe('<h1>hi</h1>')
    expect(ofetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      timeout: 10_000,
      responseType: 'text',
    }))
  })

  it('propagates ofetch errors', async () => {
    const { ofetch } = await import('ofetch')
    vi.mocked(ofetch).mockRejectedValue(new Error('404 Not Found'))
    await expect(fetchHttp('https://example.com/x', 10)).rejects.toThrow(/404/)
  })
})

describe('convertToMarkdown', () => {
  it('converts basic HTML', () => {
    const md = convertToMarkdown('<h1>Hello</h1><p>World</p>', 'https://example.com', undefined)
    expect(md).toContain('# Hello')
    expect(md).toContain('World')
  })

  it('applies minimal preset from config (filters aside)', () => {
    const html = '<html><body><main><h1>Title</h1><p>Body</p></main><aside>Ads</aside></body></html>'
    const md = convertToMarkdown(html, 'https://example.com', { minimal: true })
    expect(md).toContain('# Title')
    expect(md).toContain('Body')
    expect(md).not.toContain('Ads')
  })
})
