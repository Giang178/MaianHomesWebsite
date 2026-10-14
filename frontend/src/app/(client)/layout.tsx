// src/app/(client)/layout.tsx
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import MayaAssistant from '@/components/layout/MayaAssistant';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main>
        {children}
      </main>
      <Footer />
      <MayaAssistant />
    </div>
  );
}
