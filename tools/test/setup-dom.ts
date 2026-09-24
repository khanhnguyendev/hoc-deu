import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount every rendered tree between tests.
afterEach(cleanup)

// Browser APIs that Radix primitives use and jsdom does not implement.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

const element = Element.prototype
element.hasPointerCapture ??= () => false
element.setPointerCapture ??= () => {}
element.releasePointerCapture ??= () => {}
element.scrollIntoView ??= () => {}
