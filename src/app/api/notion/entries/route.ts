import { Client } from '@notionhq/client'
import { NextResponse } from 'next/server'

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

const DATABASE_ID = process.env.NOTION_DATABASE_ID

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || new Date().toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    const response = await notion.databases.query({
      database_id: DATABASE_ID!,
      filter: {
        and: [
          {
            property: 'Date',
            date: {
              on_or_after: startDate,
            },
          },
          {
            property: 'Date',
            date: {
              on_or_before: endDate,
            },
          },
        ],
      },
      sorts: [
        {
          property: 'Date',
          direction: 'descending',
        },
      ],
    })

    const entries = response.results.map((page: any) => {
      let sleepH = page.properties.GoneToSleepH?.number || 0
      let sleepM = page.properties.GoneToSleepM?.number || 0
      let wakeH = page.properties.AwokeH?.number || 0
      let wakeM = page.properties.AwokeM?.number || 0

      // Convert to minutes since midnight for calculations
      const sleepTimeInMinutes = sleepH * 60 + sleepM
      const wakeTimeInMinutes = wakeH * 60 + wakeM

      // Calculate total sleep time in minutes
      let totalSleepMinutes
      if (wakeTimeInMinutes >= sleepTimeInMinutes) {
        totalSleepMinutes = wakeTimeInMinutes - sleepTimeInMinutes - 12*60
      } else {
        totalSleepMinutes = (24 * 60 - sleepTimeInMinutes) + wakeTimeInMinutes - 12*60
      }

      // Format display times in 24h format
      const formatTime = (h: number, m: number) => {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }

      return {
        id: page.id,
        date: page.properties.Date?.date?.start,
        sleepTime: sleepH || sleepM ? formatTime(sleepH + 12 > 24 ? sleepH + 12 - 24 : sleepH + 12, sleepM) : '--:--',
        wakeTime: wakeH || wakeM ? formatTime(wakeH, wakeM) : '--:--',
        totalSleepHours: totalSleepMinutes > 0 ? Math.floor(totalSleepMinutes / 60) : 0,
        totalSleepMinutes: totalSleepMinutes > 0 ? totalSleepMinutes % 60 : 0,
        deepSleepPercentage: Math.max(0, (page.properties['Deep Sleep %']?.number || 0) * 100),
        remSleepPercentage: Math.max(0, (page.properties['REM Sleep %']?.number || 0) * 100),
        awakeTimeMinutes: Math.max(0, page.properties['AwakeTime']?.number || 0),
      }
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Failed to fetch Notion data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
} 