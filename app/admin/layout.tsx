import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="noise">
      <Navbar />
      <main className="pt-16 min-h-screen">
        {children}
      </main>
      <Footer />
    </div>
  )
}
