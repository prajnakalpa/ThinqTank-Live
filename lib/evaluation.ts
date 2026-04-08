import levenshtein from 'fast-levenshtein'

export interface Question {
  id: string
  correct_answer: string
  accepted_keywords: string[]
  synonyms: string[]
  weightage: number
  strictness_level: 'strict' | 'medium' | 'loose'
}

const STRICTNESS_THRESHOLD: Record<string, number> = {
  strict: 0.92,
  medium: 0.80,
  loose: 0.70,
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein.get(a, b) / maxLen
}

function matchesTerm(answer: string, term: string, threshold: number): boolean {
  const normAnswer = normalize(answer)
  const normTerm = normalize(term)
  // Exact / contains
  if (normAnswer === normTerm || normAnswer.includes(normTerm)) return true
  // Fuzzy
  return similarity(normAnswer, normTerm) >= threshold
}

export function evaluateAnswer(question: Question, rawAnswer: string): number {
  if (!rawAnswer?.trim()) return 0

  const threshold = STRICTNESS_THRESHOLD[question.strictness_level]
  const allTerms = [
    question.correct_answer,
    ...question.accepted_keywords,
    ...question.synonyms,
  ]

  for (const term of allTerms) {
    if (matchesTerm(rawAnswer, term, threshold)) {
      return question.weightage
    }
  }
  return 0
}

export function evaluateSubmission(
  questions: Question[],
  answers: Record<string, string>
): { scores: Record<string, number>; total: number } {
  const scores: Record<string, number> = {}
  let total = 0
  for (const q of questions) {
    const pts = evaluateAnswer(q, answers[q.id] || '')
    scores[q.id] = pts
    total += pts
  }
  return { scores, total }
}
