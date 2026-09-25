import { writeFileSync } from 'node:fs'
import { LOCAL_DAY_FIXTURES } from '@/lib/domain/time/fixtures'
import { LOCAL_DAY_PARITY_SQL_PATH, renderLocalDayParitySql } from './local-day-parity'

writeFileSync(LOCAL_DAY_PARITY_SQL_PATH, renderLocalDayParitySql(LOCAL_DAY_FIXTURES))
console.log(
  `local_day parity: ${LOCAL_DAY_FIXTURES.length} fixtures → ${LOCAL_DAY_PARITY_SQL_PATH}`,
)
