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
  title: "Big Deck Energy - Commander Deck Generator",
  description: "Generate a mediocre Commander deck at instant speed. Free MTG Commander/EDH deck builder with instant deck generation.",
  keywords: "MTG, Magic the Gathering, Commander, EDH, deck builder, deck generator, Big Deck Energy",
  authors: [{ name: "Big Deck Energy" }],
  openGraph: {
    title: "Big Deck Energy - Commander Deck Generator",
    description: "Generate a mediocre Commander deck at instant speed",
    url: "https://bigdeckenergy.org",
    siteName: "Big Deck Energy",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
