import type { MdreamConvertOptions, PageMetadata, SiteConfig } from './types.js'
import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
import { htmlToMarkdown as rustHtmlToMarkdown } from 'mdream'
import { resolveJsEngineOptions, resolveSiteConfig } from './mdream-config.js'

const MD_LINK_RE = /\[(?:[^\]]*)\]\(([^)]+)\)/g

export function extractLinksFromMarkdown(content: string, baseUrl: URL): string[] {
  const links = new Set<string>()
  for (const match of content.matchAll(MD_LINK_RE)) {
    const href = match[1]
    try {
      const resolved = new URL(href, baseUrl)
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:')
        links.add(resolved.href)
    }
    catch {}
  }
  return [...links]
}

export interface ConvertPageOptions {
  content: string
  isMarkdown: boolean
  parsedUrl: URL
  pageOrigin: string
  initialTitle: string
  mdreamConfig: MdreamConvertOptions | undefined
  sitesConfig: Record<string, SiteConfig> | undefined
  /**
   * Metadata extractor from crawl.ts (extractMetadataInline). Receives the parsed URL
   * and returns an extraction spec + a getMetadata callback invoked after rust conversion.
   */
  extractMetadata: (parsedUrl: URL) => {
    extraction: Record<string, (el: { textContent: string, attributes: Record<string, string> }) => void>
    getMetadata: () => PageMetadata
  }
}

/**
 * Convert a fetched page to markdown + metadata.
 * - Markdown input: skip HTML conversion, still extract links via MD_LINK_RE.
 * - HTML input: run Rust engine once for metadata extraction (full document), then
 *   run user-configured engine (Rust or JS) for actual content conversion.
 *   JS engine is chosen when mdream config has hooks (plugin transforms).
 */
export function convertPage(opts: ConvertPageOptions): { md: string, metadata: PageMetadata } {
  const { content, isMarkdown, parsedUrl, pageOrigin, initialTitle, mdreamConfig, sitesConfig, extractMetadata } = opts

  if (isMarkdown) {
    const links = extractLinksFromMarkdown(content, parsedUrl)
    return {
      md: content,
      metadata: { title: initialTitle || parsedUrl.pathname, links },
    }
  }

  const { extraction, getMetadata } = extractMetadata(parsedUrl)
  rustHtmlToMarkdown(content, { origin: pageOrigin, extraction })
  const metadata = getMetadata()

  const siteOverride = sitesConfig?.[parsedUrl.hostname]?.mdream
  const effectiveConfig = resolveSiteConfig(mdreamConfig, siteOverride)

  let md: string
  if (effectiveConfig?.hooks?.length) {
    md = jsHtmlToMarkdown(content, resolveJsEngineOptions(effectiveConfig, pageOrigin))
  }
  else {
    md = rustHtmlToMarkdown(content, { ...effectiveConfig, origin: pageOrigin } as Record<string, unknown>)
  }

  return { md, metadata }
}
