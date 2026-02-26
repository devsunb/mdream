import type { ElementNode, Plugin } from '../types.ts'
import { ELEMENT_NODE, TAG_A, TAG_H1, TAG_H6 } from '../const.ts'
import { createPlugin } from '../pluggable/plugin.ts'

/**
 * Plugin that removes heading anchor links inserted by documentation frameworks.
 *
 * Targets:
 * - Docusaurus: <a class="hash-link" href="#id" title="Direct link to ...">
 * - VitePress: <a class="header-anchor" href="#id" aria-label="Permalink to ...">
 * - Generic: <a aria-hidden="true" href="#id"> inside h1-h6
 */
export function headingAnchorPlugin(): Plugin {
  return createPlugin({
    beforeNodeProcess(event) {
      const { node } = event

      // For any node type, check if an ancestor <a> is a heading anchor
      let current: ElementNode | null = node.type === ELEMENT_NODE
        ? node as ElementNode
        : node.parent as ElementNode | null

      while (current) {
        if (isHeadingAnchorElement(current)) {
          return { skip: true }
        }
        current = current.parent as ElementNode | null
      }
    },
  })
}

function isHeadingAnchorElement(element: ElementNode): boolean {
  if (element.tagId !== TAG_A) {
    return false
  }

  const href = element.attributes?.href
  if (!href || href.charCodeAt(0) !== 35) { // '#' = 35
    return false
  }

  const cls = element.attributes?.class || ''

  // Docusaurus
  if (cls.includes('hash-link')) {
    return true
  }

  // VitePress
  if (cls.includes('header-anchor')) {
    return true
  }

  // Title-based detection
  const title = element.attributes?.title || ''
  if (title.length > 14 && title.charCodeAt(0) === 68 && title.startsWith('Direct link to')) { // 'D' = 68
    return true
  }

  // aria-label based detection (VitePress "Permalink to ...", GitHub "Permalink: ...")
  const ariaLabel = element.attributes?.['aria-label'] || ''
  if (ariaLabel.length > 9 && ariaLabel.charCodeAt(0) === 80 && ariaLabel.startsWith('Permalink')) { // 'P' = 80
    return true
  }

  // aria-hidden anchor inside heading
  if (element.attributes?.['aria-hidden'] === 'true' && isInsideHeading(element)) {
    return true
  }

  return false
}

function isInsideHeading(element: ElementNode): boolean {
  let parent = element.parent as ElementNode | null
  while (parent) {
    const tagId = parent.tagId
    if (tagId !== undefined && tagId >= TAG_H1 && tagId <= TAG_H6) {
      return true
    }
    parent = parent.parent as ElementNode | null
  }
  return false
}
