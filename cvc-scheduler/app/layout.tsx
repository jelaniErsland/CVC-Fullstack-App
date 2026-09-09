import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://projectlocal.app"),
  title: "Project Local",
  description: "Simple, secure volunteer scheduling for local projects.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Project Local",
    description: "Simple, secure volunteer scheduling for local projects.",
    url: "https://projectlocal.app",
    siteName: "Project Local",
    type: "website",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Project Local" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Project Local",
    description: "Simple, secure volunteer scheduling for local projects.",
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
