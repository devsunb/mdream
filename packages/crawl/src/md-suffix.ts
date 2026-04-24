import { ofetch } from 'ofetch'

const FETCH_HEADERS = { 'User-Agent': 'mdream-crawler/1.0', 'Accept': 'text/html,application/xhtml+xml,text/markdown' }

/**
 * Try fetching URL + '.md' suffix. Used for sites like platform.claude.com/docs
 * that serve clean markdown at URL.md endpoints.
 *
 * Returns the markdown body if content-type indicates markdown, otherwise null
 * (caller should fall back to normal HTML processing).
 */
export async function tryFetchMdSuffix(url: string): Promise<string | null> {
  const mdUrl = url.endsWith('/') ? `${url.slice(0, -1)}.md` : `${url}.md`
  try {
    const mdResponse = await ofetch.raw(mdUrl, {
      headers: FETCH_HEADERS,
      responseType: 'text' as const,
      retry: 0,
      timeout: 10000,
    })
    const mdContentType = mdResponse.headers.get('content-type') || ''
    if (mdContentType.includes('text/markdown') || mdContentType.includes('text/x-markdown'))
      return mdResponse._data ?? ''
  }
  catch {}
  return null
}
