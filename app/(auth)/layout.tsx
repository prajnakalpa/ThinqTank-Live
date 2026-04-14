// app/(auth)/layout.tsx
// Auth pages (login, reset, update-password) are full-screen standalone.
// Do NOT add Navbar/Footer here — each page manages its own layout.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
