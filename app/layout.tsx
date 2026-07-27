import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/components/auth-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-serif-display',
});

export const metadata: Metadata = {
  title: 'Mirador Montañero - Café Selecto',
  description: 'Sistema de Gestión de Inventario y Ventas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable,
          fraunces.variable
        )}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
