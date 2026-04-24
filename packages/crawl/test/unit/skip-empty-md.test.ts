import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchedUrls: string[] = []

// Return different HTML per URL so mdream mock can produce empty/non-empty content
const pageHtml: Record<string, string> = {}

vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async (url: string) => {
      fetchedUrls.push(url)
      if (url.endsWith('/robots.txt'))
        return ''
      if (url.includes('sitemap'))
        throw new Error('404')
      return '<html><body></body></html>'
    },
    {
      raw: async (url: string, _opts?: any) => {
        fetchedUrls.push(url)
        const html = pageHtml[url] || '<html><head><title>Page</title></head><body><p>Content</p></body></html>'
        return {
          _data: html,
          headers: new Headers({ 'content-type': 'text/html' }),
        }
      },
    },
  )
  return { ofetch: mockOfetch }
})

// mdream mock: return frontmatter-only for empty body, real content otherwise
vi.mock('mdream', () => ({
  htmlToMarkdown: (html: string, _opts?: any) => {
    if (html.includes('data-empty="true"'))
      return '---\ntitle: "[unavailable note]"\n---'
    return `---\ntitle: "Test"\n---\n\n# Hello\n\nThis is real content.`
  },
}))

vi.mock('@mdream/js/llms-txt', () => ({
  generateLlmsTxtArtifacts: async () => ({
    llmsTxt: '# llms.txt',
    llmsFullTxt: '# llms-full.txt',
  }),
}))

vi.mock('@clack/prompts', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  note: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

const { crawlAndGenerate } = await import('../../src/crawl.ts')

function tmpOut(): string {
  return join(tmpdir(), `mdream-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

afterEach(() => {
  fetchedUrls.length = 0
  for (const key of Object.keys(pageHtml))
    delete pageHtml[key]
})

describe('skip empty markdown files', () => {
  it('does not write a file when content is frontmatter-only', async () => {
    const outDir = tmpOut()
    pageHtml['https://example.com/empty'] = '<html><head><title>Empty</title></head><body data-empty="true"></body></html>'

    const results = await crawlAndGenerate({
      urls: ['https://example.com/empty'],
      outputDir: outDir,
      maxDepth: 0,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: true,
    })

    expect(existsSync(join(outDir, 'empty.md'))).toBe(false)
    expect(results[0].filePath).toBeUndefined()
  })

  it('writes a file when content has body beyond frontmatter', async () => {
    const outDir = tmpOut()
    pageHtml['https://example.com/real'] = '<html><head><title>Real</title></head><body><p>Real content here</p></body></html>'

    const results = await crawlAndGenerate({
      urls: ['https://example.com/real'],
      outputDir: outDir,
      maxDepth: 0,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: true,
    })

    expect(existsSync(join(outDir, 'real.md'))).toBe(true)
    expect(results[0].filePath).toBeDefined()
  })
})
