import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'
import { headingAnchorPlugin } from '../../../src/plugins/heading-anchor.ts'

describe('headingAnchorPlugin', () => {
  it('removes Docusaurus hash-link anchors from headings', () => {
    const html = '<h2>Summary<a class="hash-link" href="#summary" title="Direct link to Summary">\u200B</a></h2>'
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toBe('## Summary')
  })

  it('removes VitePress header-anchor from headings', () => {
    const html = '<h2>Summary<a class="header-anchor" href="#summary" aria-label="Permalink to &quot;Summary&quot;">\u200B</a></h2>'
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toBe('## Summary')
  })

  it('removes anchors with "Direct link to" title', () => {
    const html = '<h3>Config<a href="#config" title="Direct link to Config">\u200B</a></h3>'
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toBe('### Config')
  })

  it('removes anchors with aria-hidden in headings', () => {
    const html = '<h2>Setup<a aria-hidden="true" href="#setup">#</a></h2>'
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toBe('## Setup')
  })

  it('removes GitHub-style anchor siblings with "Permalink:" aria-label', () => {
    const html = `
      <div class="markdown-heading">
        <h2 tabindex="-1" class="heading-element">2.1.66</h2>
        <a id="user-content-2166" class="anchor" aria-label="Permalink: 2.1.66" href="#2166">
          <svg class="octicon octicon-link" viewBox="0 0 16 16" aria-hidden="true"><path d="m7.775 3.275"></path></svg>
        </a>
      </div>`
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toBe('## 2.1.66')
  })

  it('preserves normal fragment links outside headings', () => {
    const html = '<p>See <a href="#details">details section</a> below.</p>'
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toContain('[details section](#details)')
  })

  it('preserves normal links inside headings', () => {
    const html = '<h2><a href="https://example.com">External Link</a></h2>'
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toContain('[External Link](https://example.com)')
  })

  it('handles multiple headings with anchors', () => {
    const html = `
      <h2>First<a class="hash-link" href="#first" title="Direct link to First">\u200B</a></h2>
      <p>Content one</p>
      <h3>Second<a class="hash-link" href="#second" title="Direct link to Second">\u200B</a></h3>
      <p>Content two</p>
    `
    const markdown = htmlToMarkdown(html, {
      plugins: [headingAnchorPlugin()],
    })

    expect(markdown).toContain('## First')
    expect(markdown).not.toContain('Direct link to')
    expect(markdown).toContain('### Second')
    expect(markdown).toContain('Content one')
    expect(markdown).toContain('Content two')
  })
})
