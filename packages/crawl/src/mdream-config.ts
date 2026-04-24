import type { MdreamConvertOptions } from './types.js'

export const MINIMAL_FILTER_EXCLUDE = ['form', 'fieldset', 'object', 'embed', 'footer', 'aside', 'iframe', 'input', 'textarea', 'select', 'button', 'nav']

/**
 * Resolve the filter option, merging user excludes with minimal defaults when both are present.
 */
function resolveFilter(config: MdreamConvertOptions): MdreamConvertOptions['filter'] | undefined {
  const minimal = config.minimal === true
  if (!minimal)
    return config.filter
  if (!config.filter)
    return { exclude: MINIMAL_FILTER_EXCLUDE }

  const exclude = config.filter.exclude
    ? [...new Set([...MINIMAL_FILTER_EXCLUDE, ...config.filter.exclude])]
    : MINIMAL_FILTER_EXCLUDE
  return {
    ...config.filter,
    exclude,
  }
}

/**
 * Merge base mdream config with per-site overrides.
 * Site filter.exclude is appended to (not replacing) the base filter.exclude.
 * Base hooks are preserved when site doesn't override.
 */
export function resolveSiteConfig(base: MdreamConvertOptions | undefined, siteOverride: MdreamConvertOptions | undefined): MdreamConvertOptions | undefined {
  if (!siteOverride)
    return base
  if (!base)
    return siteOverride

  const merged = { ...base, ...siteOverride }

  if (base.filter?.exclude && siteOverride.filter?.exclude)
    merged.filter = { ...base.filter, ...siteOverride.filter, exclude: [...new Set([...base.filter.exclude, ...siteOverride.filter.exclude])] }
  else if (base.filter && !siteOverride.filter)
    merged.filter = base.filter

  if (base.hooks?.length && !siteOverride.hooks?.length)
    merged.hooks = base.hooks

  return merged
}

/**
 * Resolve flat MdreamConvertOptions into the EngineOptions shape
 * expected by the JS engine (plugins object + clean + origin).
 * The Rust engine resolves `minimal` internally, but the JS engine does not.
 */
export function resolveJsEngineOptions(config: MdreamConvertOptions, origin: string): Record<string, unknown> {
  const minimal = config.minimal === true
  const plugins: Record<string, unknown> = {}

  const enableFm = minimal ? config.frontmatter !== false : !!config.frontmatter
  if (enableFm)
    plugins.frontmatter = config.frontmatter === true || config.frontmatter === undefined ? true : config.frontmatter
  if (minimal ? config.isolateMain !== false : config.isolateMain)
    plugins.isolateMain = true
  if (minimal ? config.tailwind !== false : config.tailwind)
    plugins.tailwind = true

  const filter = resolveFilter(config)
  if (filter)
    plugins.filter = filter
  if (config.tagOverrides)
    plugins.tagOverrides = config.tagOverrides

  let clean: MdreamConvertOptions['clean'] = config.clean
  if (clean === undefined && minimal)
    clean = true

  return { origin, plugins, clean, hooks: config.hooks }
}
