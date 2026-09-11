import type { Metadata } from 'next'
import { Instrument_Sans, Cinzel } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const instrumentSans = Instrument_Sans({ 
  subsets: ["latin"],
  variable: '--font-instrument-sans',
  display: 'swap',
});

// Cinzel queda como fallback para estilos serif si Seagram no está disponible
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: '--font-cinzel',
  display: 'swap',
});

const seagram = localFont({
  src: "./fonts/Seagram-tfb.ttf",
  variable: "--font-seagram",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'ARTEMISA #3 | Templo Recoleta',
  description: 'Arte, DJs, Tragos de autor, Birritas, Morfi y Stands de arte. 18.04 - 16hs a 03am - Templo Recoleta, Av. Córdoba 2001',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${instrumentSans.variable} ${cinzel.variable} ${seagram.variable} bg-background`}>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
