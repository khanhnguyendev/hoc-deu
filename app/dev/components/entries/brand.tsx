import { LogoMark } from '@/components/patterns/logo-mark'
import type { Entry } from '../types'

/** `/dev/components` entries of the brand kit (`LogoMark`) (task 6.0b, Part B-M6 decision 3). */
export const BRAND_ENTRIES: Entry[] = [
  {
    name: 'LogoMark',
    layer: 'patterns',
    file: 'components/patterns/logo-mark.tsx',
    // The heat ramp follows the page's theme (`dark:fill-heat-*`) — /dev/components' ThemeToggle
    // and e2e/components.spec.ts's light/dark axe pass already cover both (task 6.0b).
    demos: [{ title: 'Mặc định', render: () => <LogoMark /> }],
  },
]
