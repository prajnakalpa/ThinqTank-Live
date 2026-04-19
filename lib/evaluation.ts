// lib/evaluation.ts
import levenshtein from 'fast-levenshtein'

export interface Question {
  id: string
  correct_answer: string
  accepted_keywords: string[]
  synonyms: string[]
  weightage: number
  strictness_level: 'strict' | 'medium' | 'loose'
}

/**
 * SAFE BASE NORMALIZATION
 */
function normalize(s: string) {
  if (!s) return ''

  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * CONTROLLED PHONETIC NORMALIZATION
 * Only applied in fallback stage
 */
function phoneticNormalize(s: string) {
  return s
    .replace(/dny/g, 'gy')
    .replace(/jn/g, 'gy')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
}

/**
 * WORD MATCH (PRIMARY ENGINE)
 */
function wordMatch(user: string, target: string, tolerance: number) {
  const stopWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at']

  const userWords = user.split(' ')
  const targetWords = target
    .split(' ')
    .filter(w => !stopWords.includes(w))

  let matched = 0

  for (const tw of targetWords) {
    const found = userWords.some(uw => {
      const dist = levenshtein.get(uw, tw)
      return dist <= tolerance
    })
    if (found) matched++
  }

  return matched === targetWords.length
}

/**
 * CONTROLLED PHONETIC MATCH
 */
function phoneticMatch(user: string, target: string, tolerance: number) {
  const ua = normalize(user)
  const tt = normalize(target)

  const userWords = ua.split(' ')
  const targetWords = tt.split(' ')

  if (Math.abs(userWords.length - targetWords.length) > 1) return false
  if (ua.length < 4 || tt.length < 4) return false

  const uaPh = phoneticNormalize(ua)
  const ttPh = phoneticNormalize(tt)

  const dist = levenshtein.get(uaPh, ttPh)

  return dist <= tolerance
}

/**
 * MATCH ENGINE
 */
function isMatch(userAnswer: string, targetTerm: string, strictness: string): boolean {
  const ua = normalize(userAnswer)
  const tt = normalize(targetTerm)

  if (!ua || !tt) return false

  if (strictness === 'strict') return ua === tt

  if (strictness === 'medium') {
    if (ua === tt) return true
    if (wordMatch(ua, tt, 1)) return true
    if (phoneticMatch(ua, tt, 1)) return true
    return false
  }

  if (strictness === 'loose') {
    if (ua === tt) return true
    if (wordMatch(ua, tt, 2)) return true
    if (phoneticMatch(ua, tt, 2)) return true
    return false
  }

  return false
}

/**
 * EVALUATE SINGLE ANSWER
 */
export function evaluateAnswer(question: Question, rawAnswer: string): number {
  if (!rawAnswer?.trim()) return 0

  const allTerms = [
    question.correct_answer,
    ...(question.accepted_keywords || []),
    ...(question.synonyms || []),
  ]

  for (const term of allTerms) {
    if (isMatch(rawAnswer, term, question.strictness_level)) {
      return question.weightage
    }
  }

  return 0
}

/**
 * EVALUATE FULL SUBMISSION
 */
export function evaluateSubmission(
  questions: Question[],
  answers: Record<string, string>
): { scores: Record<string, number>; total: number } {
  const scores: Record<string, number> = {}
  let total = 0

  for (const q of questions) {
    const userAnswer = answers[q.id]

    let pts = 0

    // ✅ MCQ HANDLING (no schema change, safe cast)
    if ((q as any).correct_option !== undefined && (q as any).correct_option !== null) {
      if (userAnswer === String((q as any).correct_option)) {
        pts = q.weightage || 1
      }
    } else {
      // existing objective logic untouched
      pts = evaluateAnswer(q, userAnswer || '')
    }

    scores[q.id] = pts
    total += pts
  }

  return { scores, total }
}
