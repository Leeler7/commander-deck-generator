import type { Metadata } from "next";
import DarkModeToggle from "@/components/DarkModeToggle";

export const metadata: Metadata = {
  title: "Stuff We Like | Big Deck Energy",
  description: "Products, tools, and affiliate links recommended by Big Deck Energy.",
};

export default function StuffPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center relative">
            <a href="/" className="inline-block">
              <h1 className="text-4xl text-black hover:text-blue-600 transition-colors"
                  style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                BIG DECK ENERGY
              </h1>
            </a>
            <p className="mt-2 text-xl text-black"
              style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
              BUILD A MEDIOCRE DECK FOR FREE AT INSTANT SPEED.
            </p>
            <div className="absolute top-0 right-0">
              <DarkModeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-4xl text-black mb-8"
              style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
            Stuff We Like
          </h2>

          <p className="text-gray-600">
            Coming soon.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-4 text-gray-700">
              Big Deck Energy is a free online MTG Commander (EDH) deck generator designed for
              casual, fun, and chaotic deck building. Generate complete 100-card Commander decks instantly.
            </p>
            <p>
              <a href="/" className="text-blue-600 hover:text-blue-500">Home</a>
              {' '}&bull;{' '}
              <a href="/faq" className="text-blue-600 hover:text-blue-500">FAQ</a>
              {' '}&bull;{' '}
              <a href="/stuff" className="text-blue-600 hover:text-blue-500">Stuff</a>
              {' '}&bull;{' '}
              <a href="/contact" className="text-blue-600 hover:text-blue-500">Contact</a>
            </p>
            <p className="mt-2">
              Deck engine by{' '}
              <a
                href="https://github.com/20q2/mtg-commander-deck-generator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500"
              >
                20q2
              </a>
              {' '}(MIT licensed) &bull;{' '}
              <a
                href="https://www.patreon.com/cw/ShadowMonk598"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500"
              >
                Support the engine developer on Patreon
              </a>
            </p>
            <p className="mt-2">
              This tool is not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast LLC.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
