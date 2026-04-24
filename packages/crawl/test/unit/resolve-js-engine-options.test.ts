import { describe, expect, it } from 'vitest'
import { resolveJsEngineOptions, resolveSiteConfig } from '../../src/mdream-config.ts'

const MINIMAL_FILTER_EXCLUDE = ['form', 'fieldset', 'object', 'embed', 'footer', 'aside', 'iframe', 'input', 'textarea', 'select', 'button', 'nav']

describe('resolveJsEngineOptions', () => {
  it('resolves minimal: true into all default plugins', () => {
    const result = resolveJsEngineOptions({ minimal: true, hooks: [] }, 'https://example.com')

    expect(result.origin).toBe('https://example.com')
    expect(result.clean).toBe(true)

    const plugins = result.plugins as Record<string, unknown>
    expect(plugins.frontmatter).toBe(true)
    expect(plugins.isolateMain).toBe(true)
    expect(plugins.tailwind).toBe(true)
    expect(plugins.filter).toEqual({ exclude: MINIMAL_FILTER_EXCLUDE })
  })

  it('allows overriding individual plugins when minimal is true', () => {
    const result = resolveJsEngineOptions({
      minimal: true,
      isolateMain: false,
      tailwind: false,
      frontmatter: false,
      hooks: [],
    }, 'https://example.com')

    const plugins = result.plugins as Record<string, unknown>
    expect(plugins.isolateMain).toBeUndefined()
    expect(plugins.tailwind).toBeUndefined()
    expect(plugins.frontmatter).toBeUndefined()
    // filter still gets the default
    expect(plugins.filter).toEqual({ exclude: MINIMAL_FILTER_EXCLUDE })
  })

  it('merges custom filter.exclude with minimal defaults', () => {
    const result = resolveJsEngineOptions({
      minimal: true,
      filter: { exclude: ['[class*="breadcrumb"]', 'header'] },
      hooks: [],
    }, 'https://example.com')

    const plugins = result.plugins as Record<string, unknown>
    const filter = plugins.filter as { exclude: string[] }
    // Should contain both minimal defaults and custom excludes
    for (const tag of MINIMAL_FILTER_EXCLUDE)
      expect(filter.exclude).toContain(tag)
    expect(filter.exclude).toContain('[class*="breadcrumb"]')
    expect(filter.exclude).toContain('header')
  })

  it('does not merge filter when minimal is false', () => {
    const result = resolveJsEngineOptions({
      filter: { exclude: ['header'] },
      hooks: [],
    }, 'https://example.com')

    const plugins = result.plugins as Record<string, unknown>
    const filter = plugins.filter as { exclude: string[] }
    expect(filter.exclude).toEqual(['header'])
  })

  it('returns empty plugins when minimal is false and nothing enabled', () => {
    const result = resolveJsEngineOptions({ hooks: [] }, 'https://example.com')

    const plugins = result.plugins as Record<string, unknown>
    expect(plugins.frontmatter).toBeUndefined()
    expect(plugins.isolateMain).toBeUndefined()
    expect(plugins.tailwind).toBeUndefined()
    expect(plugins.filter).toBeUndefined()
    expect(result.clean).toBeUndefined()
  })

  it('enables individual plugins without minimal', () => {
    const result = resolveJsEngineOptions({
      isolateMain: true,
      frontmatter: true,
      clean: { urls: true },
      hooks: [],
    }, 'https://example.com')

    const plugins = result.plugins as Record<string, unknown>
    expect(plugins.isolateMain).toBe(true)
    expect(plugins.frontmatter).toBe(true)
    expect(plugins.tailwind).toBeUndefined()
    expect(result.clean).toEqual({ urls: true })
  })

  it('passes tagOverrides through to plugins', () => {
    const result = resolveJsEngineOptions({
      minimal: true,
      tagOverrides: { 'x-heading': 'h2' },
      hooks: [],
    }, 'https://example.com')

    const plugins = result.plugins as Record<string, unknown>
    expect(plugins.tagOverrides).toEqual({ 'x-heading': 'h2' })
  })

  it('passes hooks through', () => {
    const hook = { beforeNodeProcess: () => undefined }
    const result = resolveJsEngineOptions({
      minimal: true,
      hooks: [hook],
    }, 'https://example.com')

    expect(result.hooks).toEqual([hook])
  })
})

describe('resolveSiteConfig', () => {
  it('returns base when no site override', () => {
    const base = { minimal: true, hooks: [] as unknown[] }
    expect(resolveSiteConfig(base, undefined)).toBe(base)
  })

  it('returns site override when no base', () => {
    const site = { filter: { exclude: ['header'] } }
    expect(resolveSiteConfig(undefined, site)).toBe(site)
  })

  it('merges site filter.exclude with base filter.exclude', () => {
    const base = { minimal: true, filter: { exclude: ['nav', 'footer'] }, hooks: [] as unknown[] }
    const site = { filter: { exclude: ['[class*="breadcrumb"]'] } }
    const result = resolveSiteConfig(base, site)!

    expect(result.minimal).toBe(true)
    expect(result.filter!.exclude).toContain('nav')
    expect(result.filter!.exclude).toContain('footer')
    expect(result.filter!.exclude).toContain('[class*="breadcrumb"]')
  })

  it('uses site filter when base has no filter', () => {
    const base = { minimal: true, hooks: [] as unknown[] }
    const site = { filter: { exclude: ['[class*="breadcrumb"]'] } }
    const result = resolveSiteConfig(base, site)!

    expect(result.filter!.exclude).toEqual(['[class*="breadcrumb"]'])
  })

  it('preserves base filter when site has no filter', () => {
    const base = { minimal: true, filter: { exclude: ['nav'] }, hooks: [] as unknown[] }
    const site = { clean: true as const }
    const result = resolveSiteConfig(base, site)!

    expect(result.filter!.exclude).toEqual(['nav'])
    expect(result.clean).toBe(true)
  })

  it('preserves base hooks when site has no hooks', () => {
    const hook = { beforeNodeProcess: () => undefined }
    const base = { minimal: true, hooks: [hook] as unknown[] }
    const site = { filter: { exclude: ['header'] } }
    const result = resolveSiteConfig(base, site)!

    expect(result.hooks).toEqual([hook])
  })

  it('site hooks override base hooks', () => {
    const baseHook = { beforeNodeProcess: () => undefined }
    const siteHook = { onNodeEnter: () => '' }
    const base = { minimal: true, hooks: [baseHook] as unknown[] }
    const site = { hooks: [siteHook] as unknown[] }
    const result = resolveSiteConfig(base, site)!

    expect(result.hooks).toEqual([siteHook])
  })
})
