import { useCallback, useEffect, useState } from 'react'
import type { AnswerState } from '../../shared/types'

const INITIAL: AnswerState = { status: 'idle', text: '', question: null }

export function useAnswer() {
  const [answer, setAnswer] = useState<AnswerState>(INITIAL)

  useEffect(() => {
    window.sarthi.getAnswerState().then(setAnswer)
    return window.sarthi.onAnswerState(setAnswer)
  }, [])

  const generate = useCallback((question?: string) => window.sarthi.generateAnswer(question), [])

  return { answer, generate }
}
