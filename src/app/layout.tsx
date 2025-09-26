import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { GlobalPlayerProvider } from "@/hooks/useGlobalPlayer"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Music Library",
  description: "A music library application with Spotify integration",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <GlobalPlayerProvider>
          {children}
          <Toaster />
        </GlobalPlayerProvider>
      </body>
    </html>
  )
}