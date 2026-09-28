'use client'

import type * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { vi } from '@/lib/i18n/vi'

const copy = vi.customItems.tabs

export type TrackTab = 'roadmap' | 'custom'

/**
 * The track page's two tabs (§2.4; task 6.6a) — "Lộ trình" (the roadmap) and "Mục riêng" (the
 * learner's custom items, CustomItemsTab) — shown only when the learner has custom items of the
 * track. Radix Tabs: arrow keys move between the tabs, each panel is labelled by its tab. Opens
 * on `initial` (`?tab=custom`), else the roadmap.
 */
function TrackTabs({
  roadmap,
  custom,
  initial = 'roadmap',
}: {
  roadmap: React.ReactNode
  custom: React.ReactNode
  initial?: TrackTab
}) {
  return (
    <Tabs defaultValue={initial} data-slot="track-tabs" className="gap-6">
      <TabsList aria-label={copy.label}>
        <TabsTrigger value="roadmap">{copy.roadmap}</TabsTrigger>
        <TabsTrigger value="custom">{copy.custom}</TabsTrigger>
      </TabsList>
      <TabsContent value="roadmap" className="flex flex-col gap-8">
        {roadmap}
      </TabsContent>
      <TabsContent value="custom">{custom}</TabsContent>
    </Tabs>
  )
}

export { TrackTabs }
