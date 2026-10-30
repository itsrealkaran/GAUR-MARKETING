import type React from "react"
import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
})

export const metadata: Metadata = {
  title: "GAUR LINKS – Dynamic Redirector, Smart Redirect & UTM Builder",
  description:
    "GAUR LINKS creates tracked redirect links, UTM campaign URLs, QR codes, and shareable smart links.",
  keywords:
    "GAUR LINKS, Dynamic Redirector, Smart Redirect, UTM Builder, QR Code Generator, Smart Links, URL Shortener, Marketing Tools",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "GAUR LINKS – Dynamic Redirector & Smart Link Generator",
    description: "Generate tracked smart redirects, UTM URLs, and QR codes instantly.",
    siteName: "GAUR LINKS",
    url: "https://gaurmarketing.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GAUR LINKS – Dynamic Redirector",
    description: "Build smart redirects and UTM campaign URLs in seconds.",
  },
  applicationName: "GAUR LINKS",
  generator: "Next.js"
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "GAUR LINKS",
  "alternateName": "GAUR LINKS Dynamic Redirector",
  "url": "https://gaurmarketing.com",
  "description": "GAUR LINKS creates tracked redirect links, UTM campaign URLs, QR codes, and shareable smart links.",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "All",
  "offers": {
    "@type": "Offer",
    "price": "0.00",
    "priceCurrency": "USD"
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
