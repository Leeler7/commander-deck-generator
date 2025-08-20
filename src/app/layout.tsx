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
  title: "Big Deck Energy | Free MTG Commander (EDH) Deck Generator",
  description: "Instantly generate Magic: The Gathering Commander (EDH) decks with Big Deck Energy. Build fun, casual, and chaotic decks online using our free deck generator.",
  keywords: "MTG Commander deck generator, EDH deck builder, Magic the Gathering Commander deck, free MTG deck builder, Commander deck generator online, EDH deck generator, casual Commander decks",
  authors: [{ name: "Big Deck Energy" }],
  openGraph: {
    title: "Big Deck Energy | Free MTG Commander (EDH) Deck Generator",
    description: "Instantly generate Magic: The Gathering Commander (EDH) decks with Big Deck Energy. Build fun, casual, and chaotic decks online using our free deck generator.",
    url: "https://bigdeckenergy.org",
    siteName: "Big Deck Energy",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Big Deck Energy | Free MTG Commander (EDH) Deck Generator",
    description: "Instantly generate Magic: The Gathering Commander (EDH) decks with Big Deck Energy. Build fun, casual, and chaotic decks online using our free deck generator.",
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
