export interface PageData {
  url: string
  html: string
  title: string
  metadata: PageMetadata
  origin: string
}

export interface CrawlHooks {
  'crawl:url': (ctx: { url: string, skip: boolean }) => void | Promise<void>
  'crawl:page': (page: PageData) => void | Promise<void>
  'crawl:content': (ctx: { url: string, title: string, content: string, filePath: string }) => void | Promise<void>
  'crawl:done': (ctx: { results: CrawlResult[] }) => void | Promise<void>
}

export interface CrawlOptions {
  urls: string[]
  outputDir: string
  maxRequestsPerCrawl?: number
  generateLlmsTxt?: boolean
  generateLlmsFullTxt?: boolean
  generateIndividualMd?: boolean
  origin?: string
  chunkSize?: number
  driver?: 'http' | 'playwright'
  useChrome?: boolean
  followLinks?: boolean
  maxDepth?: number
  globPatterns?: ParsedUrlPattern[]
  crawlDelay?: number
  exclude?: string[]
  include?: string[]
  siteNameOverride?: string
  descriptionOverride?: string
  verbose?: boolean
  skipSitemap?: boolean
  allowSubdomains?: boolean
  tryMdSuffix?: boolean
  hooks?: Partial<{ [K in keyof CrawlHooks]: CrawlHooks[K] | CrawlHooks[K][] }>
  onPage?: (page: PageData) => Promise<void> | void
  /** Mdream HTML-to-Markdown conversion options. */
  mdream?: MdreamConvertOptions
  /** Per-site mdream overrides. Key is hostname (e.g. "ghostty.org"). Merged on top of base mdream config. */
  sites?: Record<string, SiteConfig>
}

export interface SiteConfig {
  /** URL include glob patterns (site-scoped, merged with global include). */
  include?: string[]
  /** URL exclude glob patterns (site-scoped, merged with global exclude). */
  exclude?: string[]
  /** Skip sitemap.xml and robots.txt discovery for this site. */
  skipSitemap?: boolean
  mdream?: MdreamConvertOptions
}

export interface MdreamConvertOptions {
  /** Enable minimal preset (frontmatter, isolateMain, tailwind, filter, clean). */
  minimal?: boolean
  /** Extract frontmatter from HTML head. */
  frontmatter?: boolean
  /** Isolate main content area. */
  isolateMain?: boolean
  /** Convert Tailwind utility classes. */
  tailwind?: boolean
  /** Filter elements by tag/selector. */
  filter?: { include?: string[], exclude?: string[], processChildren?: boolean }
  /** Clean up markdown output. Pass true for all cleanup or an object for specific features. */
  clean?: boolean | {
    urls?: boolean
    fragments?: boolean
    emptyLinks?: boolean
    blankLines?: boolean
    redundantLinks?: boolean
    selfLinkHeadings?: boolean
    emptyImages?: boolean
    emptyLinkText?: boolean
  }
  /** Tag overrides for customizing tag behavior. */
  tagOverrides?: Record<string, { enter?: string, exit?: string, spacing?: number[], isInline?: boolean, isSelfClosing?: boolean, collapsesInnerWhiteSpace?: boolean, alias?: string } | string>
  /** Hook-based transform plugins (@mdream/js). When provided, the JS engine is used. */
  hooks?: unknown[]
}

export interface MdreamCrawlConfig {
  exclude?: string[]
  include?: string[]
  driver?: 'http' | 'playwright'
  maxDepth?: number
  maxPages?: number
  crawlDelay?: number
  skipSitemap?: boolean
  allowSubdomains?: boolean
  tryMdSuffix?: boolean
  verbose?: boolean
  artifacts?: ('llms.txt' | 'llms-full.txt' | 'markdown')[]
  hooks?: Partial<{ [K in keyof CrawlHooks]: CrawlHooks[K] | CrawlHooks[K][] }>
  /** Mdream HTML-to-Markdown conversion options. */
  mdream?: MdreamConvertOptions
  /** Per-site mdream overrides. Key is hostname (e.g. "ghostty.org"). Merged on top of base mdream config. */
  sites?: Record<string, SiteConfig>
}

export function defineConfig(config: MdreamCrawlConfig): MdreamCrawlConfig {
  return config
}

export interface ParsedUrlPattern {
  baseUrl: string
  pattern: string
  isGlob: boolean
}

export interface PageMetadata {
  title: string
  description?: string
  keywords?: string
  author?: string
  links: string[]
}

export interface CrawlResult {
  url: string
  title: string
  content: string
  filePath?: string
  timestamp: number
  success: boolean
  error?: string
  metadata?: PageMetadata
  depth?: number
}
