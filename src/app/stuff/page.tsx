import type { Metadata } from "next";
import DarkModeToggle from "@/components/DarkModeToggle";

export const metadata: Metadata = {
  title: "Stuff We Like | Big Deck Energy",
  description: "Products, tools, and gear recommended by Big Deck Energy for MTG Commander players.",
};

export default function StuffPage() {
  const products = [
    {
      name: "Kabinka Commander Deck Box (6-Deck Modular)",
      description: "Modular deck box that holds up to 6 Commander decks. Perfect for bringing your whole collection to game night.",
      url: "https://amzn.to/49AA9Iq",
      asin: "B0FP4KKSL1",
    },
    {
      name: "Kabinka Commander Sideboard Box",
      description: "Sideboard companion to the Kabinka deck box. Extra storage for tokens, dice, and sideboard cards.",
      url: "https://amzn.to/4niM3MZ",
      asin: "B0G4WC8VK7",
    },
    {
      name: "Dragon Shield Standard Sleeves",
      description: "The gold standard for card sleeves. Durable, shuffleable, and available in every color imaginable.",
      url: "https://amzn.to/4db7YAX",
      asin: "B0777MQF5Z",
    },
    {
      name: "Dragon Shield Card Codex Portfolio",
      description: "Premium binder-style portfolio for displaying and protecting your favorite cards.",
      url: "https://amzn.to/4u2a1yB",
      asin: "B0BZ6D93MC",
    },
    {
      name: "Monster 3200-Count Card Storage Box",
      description: "Sturdy cardboard storage box for your bulk collection. Holds up to 3200 cards with dividers.",
      url: "https://amzn.to/3Ph13y6",
      asin: "B09TY7B2XL",
    },
  ];

  const getImageUrl = (asin: string) =>
    `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=${asin}&Format=_SL250_&ID=AsinImage&MarketPlace=US&ServiceVersion=20070822&WS=1&tag=bigdeckenergy-20`;

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-4xl text-black mb-4"
              style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
            Stuff We Like
          </h2>
          <p className="text-gray-600">
            Gear we use and recommend for Commander nights. These are affiliate links — they help support the site at no extra cost to you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <a
              key={index}
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-400 transition-all flex flex-col"
            >
              <div className="bg-white p-4 flex items-center justify-center h-56">
                <img
                  src={getImageUrl(product.asin)}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {product.name}
                </h3>
                <p className="text-xs text-gray-500 flex-1">
                  {product.description}
                </p>
                <span className="inline-block mt-3 text-xs font-medium text-blue-600">
                  View on Amazon →
                </span>
              </div>
            </a>
          ))}
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
