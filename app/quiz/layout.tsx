// app/quiz/layout.tsx
// Quiz is a full-screen standalone experience with its own sticky header.
// No shared Navbar or Footer — they would conflict with the quiz UI.
export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
