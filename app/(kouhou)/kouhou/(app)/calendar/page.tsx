import { Suspense } from 'react'
import { CalendarScreen } from '@/components/kouhou/screens/calendar-screen'

export const metadata = { title: 'カレンダー' }

export default function Page() {
  return (
    <Suspense>
      <CalendarScreen />
    </Suspense>
  )
}
