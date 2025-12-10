import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Sidebar } from '@/components/layout/sidebar'

import { CommandMenu } from '@/components/command-menu'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EmbyInsight - Viewing Statistics Dashboard',
  description: 'Visualize and analyze your Emby media server viewing statistics',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <CommandMenu />
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-auto lg:ml-72">
              <div className="p-4 md:p-6 w-full">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
