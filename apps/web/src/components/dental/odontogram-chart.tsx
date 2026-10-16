/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { cn } from '@/lib/utils'

export interface OdontogramToothData {
  toothNumber: number
  condition: string
  surfaces?: string[]
  notes?: string
}

interface OdontogramChartProps {
  activeTooth: number | null
  onSelectTooth: (toothNumber: number) => void
  teethData?: OdontogramToothData[]
  type?: 'adult' | 'pediatric'
}

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]

const PRIMARY_UPPER_RIGHT = [55, 54, 53, 52, 51]
const PRIMARY_UPPER_LEFT = [61, 62, 63, 64, 65]
const PRIMARY_LOWER_RIGHT = [85, 84, 83, 82, 81]
const PRIMARY_LOWER_LEFT = [71, 72, 73, 74, 75]

export function OdontogramChart({ activeTooth, onSelectTooth, teethData = [], type = 'adult' }: OdontogramChartProps) {
  const renderTooth = (num: number, isUpper: boolean) => {
    const isActive = activeTooth === num
    const toothRecord = teethData.find(t => t.toothNumber === num)
    const condition = toothRecord?.condition || 'SOUND'
    const surfaces = toothRecord?.surfaces || []

    const getSurfaceColor = (surfaceCode: string) => {
      if (condition === 'MISSING' || condition === 'EXTRACTION') return 'transparent'
      const isSelected = surfaces.includes(surfaceCode)

      if (condition === 'CARIES') {
        if (isSelected) return '#ef4444'
        if (surfaces.length === 0) return '#fca5a5'
        return isActive ? '#fef2f2' : '#ffffff'
      }
      if (condition === 'RESTORED_COMPOSITE') {
        if (isSelected) return '#3b82f6'
        if (surfaces.length === 0) return '#93c5fd'
        return isActive ? '#eff6ff' : '#ffffff'
      }
      if (condition === 'CROWN') return '#fcd34d'

      if (isSelected) return '#cbd5e1'
      return isActive ? '#eff6ff' : '#ffffff'
    }

    const strokeColor = isActive ? '#3b82f6' : '#a1a1aa'

    return (
      <div 
        key={num}
        onClick={() => onSelectTooth(num)}
        className={cn(
          "flex flex-col items-center gap-1 cursor-pointer group transition-all duration-300",
          isActive ? "scale-110 z-10" : "hover:scale-105"
        )}
      >
        {isUpper && <span className={cn("text-xs font-semibold mb-2", isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>{num}</span>}
        
        <div className="relative flex flex-col items-center justify-center">
          {condition === 'EXTRACTION' && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="w-10 h-1 bg-red-500 rotate-45 absolute rounded-full shadow-sm" />
              <div className="w-10 h-1 bg-red-500 -rotate-45 absolute rounded-full shadow-sm" />
            </div>
          )}
          {condition === 'MISSING' && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-[10px] font-bold text-zinc-400 opacity-60">MISSING</div>
            </div>
          )}

          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            className={cn(
              "w-9 h-9 transition-all duration-300",
              isUpper && "rotate-180",
              condition === 'MISSING' || condition === 'EXTRACTION' ? 'opacity-20' : 'opacity-100'
            )}
          >
            <path 
              d="M 7 2 C 3 2 3 7 3 9 C 3 13 4 16 5 19 L 6 22 C 6.5 23 8 23 9 22 L 11 17 C 11.5 16 12.5 16 13 17 L 15 22 C 16 23 17.5 23 18 22 L 19 19 C 20 16 21 13 21 9 C 21 7 21 2 17 2 C 15 2 13 4 12 4 C 11 4 9 2 7 2 Z" 
              fill={getSurfaceColor('O')}
              stroke={strokeColor} 
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {!isUpper && <span className={cn("text-xs font-semibold mt-2", isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>{num}</span>}
      </div>
    )
  }

  const isPediatric = type === 'pediatric'
  const ur = isPediatric ? PRIMARY_UPPER_RIGHT : UPPER_RIGHT
  const ul = isPediatric ? PRIMARY_UPPER_LEFT : UPPER_LEFT
  const lr = isPediatric ? PRIMARY_LOWER_RIGHT : LOWER_RIGHT
  const ll = isPediatric ? PRIMARY_LOWER_LEFT : LOWER_LEFT

  return (
    <div className="flex flex-col gap-12 py-4">
      <div className="flex flex-col gap-2">
        <div className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
          Maxillary (Upper) {isPediatric ? '- Primary' : ''}
        </div>
        <div className="flex justify-center gap-1 sm:gap-2">
          <div className="flex gap-1 sm:gap-2 pr-2 sm:pr-4 border-r-2 border-dashed border-border/60">
            {ur.map(num => renderTooth(num, true))}
          </div>
          <div className="flex gap-1 sm:gap-2 pl-2 sm:pl-4">
            {ul.map(num => renderTooth(num, true))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-center gap-1 sm:gap-2">
          <div className="flex gap-1 sm:gap-2 pr-2 sm:pr-4 border-r-2 border-dashed border-border/60">
            {lr.map(num => renderTooth(num, false))}
          </div>
          <div className="flex gap-1 sm:gap-2 pl-2 sm:pl-4">
            {ll.map(num => renderTooth(num, false))}
          </div>
        </div>
        <div className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mt-2">
          Mandibular (Lower) {isPediatric ? '- Primary' : ''}
        </div>
      </div>
    </div>
  )
}
