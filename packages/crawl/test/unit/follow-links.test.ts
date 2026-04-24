import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Track fetched URLs for assertions
const fetchedUrls: string[] = []

// Page content registry: maps URL paths to { body, contentType }
const pageRegistry: Record<string, { body: string, contentType: string }> = {
  '/': { body: '<html><head><title>Home</title></head><body><a href="/about">About</a><a href="/blog">Blog</a></body></html>', contentType: 'text/html' },
  '/about': { body: '<html><head><title>About</title></head><body><a href="/about/team">Team</a><p>About page</p></body></html>', contentType: 'text/html' },
  '/blog': { body: '<html><head><title>Blog</title></head><body><a href="/blog/post-1">Post 1</a></body></html>', contentType: 'text/html' },
  '/about/team': { body: '<html><head><title>Team</title></head><body><a href="/about/team/alice">Alice</a><p>Team page</p></body></html>', contentType: 'text/html' },
  '/blog/post-1': { body: '<html><head><title>Post 1</title></head><body><p>Blog post</p></body></html>', contentType: 'text/html' },
  '/about/team/alice': { body: '<html><head><title>Alice</title></head><body><p>Alice bio</p></body></html>', contentType: 'text/html' },
}

const defaultPage = { body: '<html><head><title>404</title></head><body><p>Not found</p></body></html>', contentType: 'text/html' }

function getPageForUrl(url: string): { body: string, contentType: string } {
  const path = new URL(url).pathname
  return pageRegistry[path] || defaultPage
}

// Mock ofetch to serve pages from registry
vi.mock('ofetch', () => {
  const mockOfetch = Object.assign(
    async (url: string) => {
      fetchedUrls.push(url)
      if (url.endsWith('/robots.txt'))
        return ''
      if (url.includes('sitemap'))
        throw new Error('404')
      return getPageForUrl(url).body
    },
    {
      raw: async (url: string, _opts?: any) => {
        fetchedUrls.push(url)
        const page = getPageForUrl(url)
        return {
          _data: page.body,
          headers: new Headers({ 'content-type': page.contentType }),
        }
      },
    },
  )

  return { ofetch: mockOfetch }
})

// Use real mdream so extraction callbacks fire and links are discovered
// Mock llms-txt artifact generation
vi.mock('@mdream/js/llms-txt', () => ({
  generateLlmsTxtArtifacts: async () => ({
    llmsTxt: '# llms.txt',
    llmsFullTxt: '# llms-full.txt',
  }),
}))

// Suppress @clack/prompts output
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
})

describe('follow links (BFS crawling)', () => {
  it('discovers and crawls linked pages when followLinks is enabled', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 1,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should have crawled home + discovered /about and /blog at depth 1
    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).toContain('/about')
    expect(crawledPaths).toContain('/blog')
    // Should NOT have followed depth 2 links
    expect(crawledPaths).not.toContain('/about/team')
    expect(crawledPaths).not.toContain('/blog/post-1')
    expect(results.length).toBeGreaterThanOrEqual(3)
  })

  it('respects maxDepth=2 and crawls two levels deep', async () => {
    const results = await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 2,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).toContain('/about')
    expect(crawledPaths).toContain('/blog')
    expect(crawledPaths).toContain('/about/team')
    expect(crawledPaths).toContain('/blog/post-1')
    // Depth 3 links should NOT be followed
    expect(crawledPaths).not.toContain('/about/team/alice')
    expect(results.length).toBeGreaterThanOrEqual(5)
  })

  it('does not follow links when followLinks is false', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 3,
      followLinks: false,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).not.toContain('/about')
    expect(crawledPaths).not.toContain('/blog')
  })

  it('does not crawl duplicate URLs', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 3,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Count occurrences of each path
    const pathCounts: Record<string, number> = {}
    for (const url of fetchedUrls) {
      const path = new URL(url).pathname
      pathCounts[path] = (pathCounts[path] || 0) + 1
    }
    // Each page should only be fetched once
    for (const [path, count] of Object.entries(pathCounts)) {
      expect(count, `${path} fetched ${count} times`).toBe(1)
    }
  })

  it('respects maxRequestsPerCrawl limit across BFS waves', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 3,
      maxRequestsPerCrawl: 3,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    // Should process at most 3 URLs total
    expect(fetchedUrls.length).toBeLessThanOrEqual(3)
  })

  it('respects per-site exclude patterns', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 2,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
      sites: {
        'example.com': {
          exclude: ['*/blog*'],
        },
      },
    })

    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).toContain('/about')
    // /blog and /blog/post-1 should be excluded by site config
    expect(crawledPaths).not.toContain('/blog')
    expect(crawledPaths).not.toContain('/blog/post-1')
  })

  it('follows .md links from llms.txt without isContentUrl filtering', async () => {
    // Register llms.txt with markdown links pointing to .md URLs
    pageRegistry['/llms.txt'] = {
      body: '# Docs\n\n- [Getting Started](https://example.com/docs/getting-started.md): Intro\n- [API Reference](https://example.com/docs/api.md): API docs\n',
      contentType: 'text/plain',
    }
    pageRegistry['/docs/getting-started.md'] = {
      body: '<html><head><title>Getting Started</title></head><body><p>Welcome</p></body></html>',
      contentType: 'text/html',
    }
    pageRegistry['/docs/api.md'] = {
      body: '<html><head><title>API Reference</title></head><body><p>API docs</p></body></html>',
      contentType: 'text/html',
    }

    await crawlAndGenerate({
      urls: ['https://example.com/llms.txt'],
      outputDir: tmpOut(),
      maxDepth: 1,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
    })

    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    expect(crawledPaths).toContain('/llms.txt')
    // .md URLs from llms.txt should be followed (not rejected by isContentUrl)
    expect(crawledPaths).toContain('/docs/getting-started.md')
    expect(crawledPaths).toContain('/docs/api.md')

    // Cleanup
    delete pageRegistry['/llms.txt']
    delete pageRegistry['/docs/getting-started.md']
    delete pageRegistry['/docs/api.md']
  })

  it('respects per-site include patterns', async () => {
    await crawlAndGenerate({
      urls: ['https://example.com'],
      outputDir: tmpOut(),
      maxDepth: 2,
      followLinks: true,
      skipSitemap: true,
      generateLlmsTxt: false,
      generateLlmsFullTxt: false,
      generateIndividualMd: false,
      sites: {
        'example.com': {
          include: ['/about/**'],
        },
      },
    })

    const crawledPaths = fetchedUrls.map(u => new URL(u).pathname)
    // Home page is the seed URL, always fetched
    expect(crawledPaths).toContain('/')
    expect(crawledPaths).toContain('/about')
    expect(crawledPaths).toContain('/about/team')
    // /blog should not match the include pattern
    expect(crawledPaths).not.toContain('/blog')
  })
})
