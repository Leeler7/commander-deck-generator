import type { Metadata } from "next";
import HeaderMenu from "@/components/HeaderMenu";

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
      image: "https://m.media-amazon.com/images/I/71QfPq5CXbL._AC_SX300_.jpg",
    },
    {
      name: "Kabinka Commander Sideboard Box",
      description: "Sideboard companion to the Kabinka deck box. Extra storage for tokens, dice, and sideboard cards.",
      url: "https://amzn.to/4niM3MZ",
      image: "https://m.media-amazon.com/images/I/919j9aN-EaL._AC_SX300_.jpg",
    },
    {
      name: "Dragon Shield Standard Sleeves",
      description: "The gold standard for card sleeves. Durable, shuffleable, and available in every color imaginable.",
      url: "https://amzn.to/4db7YAX",
      image: "https://m.media-amazon.com/images/I/91jlkFZ3EnL._AC_SX300_.jpg",
    },
    {
      name: "Dragon Shield Card Codex Portfolio",
      description: "Premium binder-style portfolio for displaying and protecting your favorite cards.",
      url: "https://amzn.to/4u2a1yB",
      image: "https://m.media-amazon.com/images/I/61JudwyD9ZL._AC_SX300_.jpg",
    },
    {
      name: "Monster 3200-Count Card Storage Box",
      description: "Sturdy cardboard storage box for your bulk collection. Holds up to 3200 cards with dividers.",
      url: "https://amzn.to/3Ph13y6",
      image: "https://m.media-amazon.com/images/I/51MMZg4dqFL._AC_SX300_.jpg",
    },
    {
      name: "MTG Dice Counters & Keyword Tokens (78 Pieces)",
      description: "Bulk set of +1/+1 counters, keyword counters, and ability tokens. Essential for any Commander game with lots of counters.",
      url: "https://amzn.to/4d05vuu",
      image: "https://m.media-amazon.com/images/I/81NVbgTHkKL._AC_SX300_.jpg",
    },
    {
      name: "C4 Energy Drink (Strawberry Blast, 12 Pack)",
      description: "Zero sugar preworkout energy with 200mg caffeine. Fuel for those long Commander nights.",
      url: "https://amzn.to/3P6rl6o",
      image: "https://m.media-amazon.com/images/I/81rRSIKm2TL._AC_SX300_.jpg",
    },
    {
      name: "Gas-X Total Relief Chewable Tablets",
      description: "Maximum strength bloating and heartburn relief. For when the game store pizza hits different.",
      url: "https://amzn.to/4uFCv15",
      image: "https://m.media-amazon.com/images/I/71EIRvILAlL._AC_SX300_.jpg",
    },
    {
      name: "MTG Lost Caverns of Ixalan Commander Deck — Explorers of the Deep",
      description: "Precon Commander deck featuring merfolk and exploration themes. Great out-of-the-box fun.",
      url: "https://amzn.to/4uHS48x",
      image: "https://m.media-amazon.com/images/I/81KkdtE3smL._AC_SX300_.jpg",
    },
    {
      name: "MTG Dominaria United Commander Deck — Legends' Legacy",
      description: "Legendary-matters Commander precon. Packed with iconic legends and solid value.",
      url: "https://amzn.to/4tUqi8A",
      image: "https://m.media-amazon.com/images/I/81O7rd9RVDL._AC_SX300_.jpg",
    },
    {
      name: "MTG Murders at Karlov Manor Commander Deck — Revenant Recon",
      description: "Surveil and graveyard-themed Commander precon. Spy on your opponents and reanimate threats.",
      url: "https://amzn.to/4wAWNdZ",
      image: "https://m.media-amazon.com/images/I/71nNXGx47hL._AC_SX300_.jpg",
    },
    {
      name: "MTG x TMNT Commander Deck — Turtle Power!",
      description: "Teenage Mutant Ninja Turtles crossover Commander deck. Cowabunga into your next game night.",
      url: "https://amzn.to/4eGz0CR",
      image: "https://m.media-amazon.com/images/I/71ORUC529bL._AC_SX300_.jpg",
    },
  ];


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
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
            <HeaderMenu />
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
                  src={product.image}
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
