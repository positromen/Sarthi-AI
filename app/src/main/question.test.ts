import { describe, expect, it } from 'vitest'
import { classifyQuestion, isQuestion } from './question'

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

describe('classifyQuestion', () => {
  it('spots behavioral questions, even when they mention technical work', () => {
    expect(classifyQuestion('Tell me about a time you disagreed with your manager')).toBe('behavioral')
    expect(classifyQuestion('Give me an example of a conflict in your team')).toBe('behavioral')
    expect(classifyQuestion('Describe a situation where you designed a system under pressure')).toBe('behavioral')
    expect(classifyQuestion("What's your greatest weakness?")).toBe('behavioral')
  })

  it('spots coding questions, and anything asked with a screenshot attached', () => {
    expect(classifyQuestion('Find the longest substring without repeating characters')).toBe('coding')
    expect(classifyQuestion('Write a function to reverse a linked list')).toBe('coding')
    expect(classifyQuestion('What is the time complexity of binary search?')).toBe('coding')
    expect(classifyQuestion('Solve this', { screenshots: 1 })).toBe('coding')
  })

  it('spots technical and design questions', () => {
    expect(classifyQuestion('How would you design a URL shortener?')).toBe('technical')
    expect(classifyQuestion("What's the difference between TCP and UDP?")).toBe('technical')
    expect(classifyQuestion('How does Modbus handle authentication?')).toBe('technical')
  })

  it('treats everything else as general', () => {
    expect(classifyQuestion('Tell me about yourself')).toBe('general')
    expect(classifyQuestion('Why do you want to join us?')).toBe('general')
    expect(classifyQuestion('आप हमारी कंपनी क्यों जॉइन करना चाहते हैं?')).toBe('general')
  })
})
