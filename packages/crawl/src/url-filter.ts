import type { ParsedUrlPattern, SiteConfig } from './types.js'
import picomatch from 'picomatch'
import { getRegistrableDomain, isUrlExcluded, matchesGlobPattern, parseUrlPattern } from './glob-utils.js'

/**
 * Check if a URL matches any of the given glob patterns.
 * Local duplicate of the pattern-matching helper so glob-utils.ts stays identical to upstream.
 */
function urlMatchesAnyPattern(url: string, patterns: string[], allowSubdomains: boolean): boolean {
  try {
    const urlObj = new URL(url)
    const urlPath = urlObj.pathname + urlObj.search + urlObj.hash

    return patterns.some((pattern) => {
      if (pattern.includes('://')) {
        const parsedPattern = parseUrlPattern(pattern)
        if (parsedPattern.isGlob) {
          return matchesGlobPattern(url, parsedPattern, allowSubdomains)
        }
        return url === pattern
      }

      if (pattern.startsWith('/')) {
        const adjustedPattern = pattern.endsWith('/*') ? pattern.replace('/*', '/**') : pattern
        return picomatch(adjustedPattern)(urlPath)
      }

      return picomatch(pattern)(urlPath)
        || picomatch(pattern)(urlPath.substring(1))
    })
  }
  catch {
    return false
  }
}

/**
 * Check if a URL should be included based on include patterns.
 * Returns true if no include patterns are specified (include everything by default).
 */
export function isUrlIncluded(url: string, includePatterns: string[], allowSubdomains = false): boolean {
  if (!includePatterns || includePatterns.length === 0)
    return true
  return urlMatchesAnyPattern(url, includePatterns, allowSubdomains)
}

export interface UrlAllowOptions {
  include: string[]
  exclude: string[]
  sitesConfig?: Record<string, SiteConfig>
  allowSubdomains: boolean
}

/**
 * Build a predicate that applies global include/exclude + per-site include/exclude.
 * Does NOT check glob patterns or domain allowlists - wrap with createShouldCrawl for that.
 */
export function createUrlAllowChecker(opts: UrlAllowOptions): (url: string) => boolean {
  const { include, exclude, sitesConfig, allowSubdomains } = opts
  return (url: string): boolean => {
    if (!isUrlIncluded(url, include, allowSubdomains))
      return false
    if (isUrlExcluded(url, exclude, allowSubdomains))
      return false

    if (sitesConfig) {
      try {
        const hostname = new URL(url).hostname
        const siteConf = sitesConfig[hostname]
        if (siteConf) {
          if (siteConf.include?.length && !isUrlIncluded(url, siteConf.include, allowSubdomains))
            return false
          if (siteConf.exclude?.length && isUrlExcluded(url, siteConf.exclude, allowSubdomains))
            return false
        }
      }
      catch {}
    }

    return true
  }
}

export interface ShouldCrawlOptions extends UrlAllowOptions {
  hasGlobPatterns: boolean
  patterns: ParsedUrlPattern[]
  allowedHostnames: Set<string>
  allowedRegistrableDomains: Set<string> | undefined
}

/**
 * Build the shouldCrawlUrl predicate used during BFS link following.
 * Combines UrlAllowChecker with domain/glob gating.
 */
export function createShouldCrawl(opts: ShouldCrawlOptions): (url: string) => boolean {
  const urlAllowed = createUrlAllowChecker(opts)
  const { hasGlobPatterns, patterns, allowedHostnames, allowedRegistrableDomains, allowSubdomains } = opts

  return (url: string): boolean => {
    if (!urlAllowed(url))
      return false

    if (!hasGlobPatterns) {
      try {
        const h = new URL(url).hostname
        if (allowedRegistrableDomains)
          return allowedRegistrableDomains.has(getRegistrableDomain(h))
        return allowedHostnames.has(h)
      }
      catch {
        return false
      }
    }
    return patterns.some(pattern => matchesGlobPattern(url, pattern, allowSubdomains))
  }
}

/**
 * Filter sitemap URLs using global include/exclude + per-site rules, optionally
 * further restricted to glob pattern matches.
 */
export function filterSitemapUrls(
  sitemapUrls: string[],
  opts: UrlAllowOptions & { hasGlobPatterns: boolean, patterns: ParsedUrlPattern[] },
): string[] {
  const isAllowed = createUrlAllowChecker(opts)
  if (opts.hasGlobPatterns) {
    return sitemapUrls.filter(url =>
      isAllowed(url) && opts.patterns.some(pattern => matchesGlobPattern(url, pattern, opts.allowSubdomains)),
    )
  }
  return sitemapUrls.filter(isAllowed)
}
