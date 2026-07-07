import type { Metadata } from "next";
import { Marcellus, Crimson_Pro, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "mana-font/css/mana.css";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

const brandFont = Marcellus({
  weight: "400",
  variable: "--font-brand",
  subsets: ["latin"],
});

const flavorFont = Crimson_Pro({
  style: ["normal", "italic"],
  weight: ["400", "600"],
  variable: "--font-flavor",
  subsets: ["latin"],
});

const sansFont = Instrument_Sans({
  variable: "--font-sans-body",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  weight: ["400", "600"],
  variable: "--font-mono-data",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-KY5PDR2M13"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-KY5PDR2M13');
          `}
        </Script>
      </head>
      <body
        className={`${brandFont.variable} ${flavorFont.variable} ${sansFont.variable} ${monoFont.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
