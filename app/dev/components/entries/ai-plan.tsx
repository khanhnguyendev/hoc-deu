import type * as React from 'react'
import { AiPlanNote } from '@/features/today/components/ai-plan-note'
import type { Entry } from '../types'

/** `/dev/components` entries of the AI plan note (task 6.5b, Part B-M6 decision 3). */

const RATIONALE = 'Ôn lại Group Anagrams vì lần trước chưa làm được, sau đó học tiếp Stack.'
const LONG_RATIONALE =
  'Hôm qua bạn làm Two Sum và Valid Anagram khá nhanh nhưng Group Anagrams còn gợi ý, nên hôm nay ôn lại bằng cách tự giải lại từ đầu trước khi sang phần Stack. Phần bài mới giữ ở mức hai bài để không vượt ngân sách 60 phút, và thẻ tiếng Anh về họp stand-up được xếp cuối buổi. Supercalifragilisticexpialidocious-một-từ-rất-dài.'

const width = (node: React.ReactNode) => <div className="w-full max-w-2xl">{node}</div>

export const AI_PLAN_ENTRIES: Entry[] = [
  {
    name: 'AiPlanNote',
    layer: 'features',
    file: 'features/today/components/ai-plan-note.tsx',
    demos: [
      {
        title: 'Kế hoạch AI: huy hiệu và lý do',
        render: () => width(<AiPlanNote view={{ rationale: RATIONALE }} />),
      },
      {
        title: 'Lý do dài (tối đa 280 ký tự): xuống dòng, từ dài tự ngắt',
        render: () => width(<AiPlanNote view={{ rationale: LONG_RATIONALE }} />),
      },
      {
        title: 'Không có lý do (trạng thái rỗng): chỉ huy hiệu',
        render: () => width(<AiPlanNote view={{ rationale: null }} />),
      },
    ],
  },
]
