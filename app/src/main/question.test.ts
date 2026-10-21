import { describe, expect, it } from 'vitest'
import { isQuestion } from './question'

describe('isQuestion', () => {
  it('detects interview questions', () => {
    expect(isQuestion('What is your greatest weakness?')).toBe(true)
    expect(isQuestion('Tell me about yourself')).toBe(true)
    expect(isQuestion('Walk me through your resume.')).toBe(true)
    expect(isQuestion('Can you describe a time you failed')).toBe(true)
    expect(isQuestion('How do you handle conflict')).toBe(true)
    expect(isQuestion('Describe your ideal work environment')).toBe(true)
  })

  it('ignores statements and acknowledgements', () => {
    expect(isQuestion('')).toBe(false)
    expect(isQuestion('   ')).toBe(false)
    expect(isQuestion('Thanks for coming in today.')).toBe(false)
    expect(isQuestion('I see, that makes sense.')).toBe(false)
    expect(isQuestion('Great, let me introduce the team.')).toBe(false)
    expect(isQuestion('Your background looks strong.')).toBe(false)
  })
})
