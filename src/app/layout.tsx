import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { GlobalPlayerProvider } from "@/hooks/useGlobalPlayer"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Music Library",
  description: "A music library application with Spotify integration",
  other: {
    'preconnect-googleapis': 'https://fonts.googleapis.com',
    'preconnect-gstatic': 'https://fonts.gstatic.com',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Science+Gothic:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className={inter.className}>
        <GlobalPlayerProvider>
          {children}
          <Toaster />
        </GlobalPlayerProvider>
      </body>
    </html>
  )
}