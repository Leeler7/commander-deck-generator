import type { Metadata } from "next";
import HeaderMenu from "@/components/HeaderMenu";

export const metadata: Metadata = {
  title: "Affiliate Disclosure | Big Deck Energy",
  description: "Affiliate disclosure for Big Deck Energy MTG Commander deck generator.",
};

export default function DisclosurePage() {
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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-4xl text-black mb-6"
            style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
          Affiliate Disclosure
        </h2>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 space-y-6 text-gray-700 text-sm leading-relaxed">
          <p>
            Big Deck Energy (bigdeckenergy.org) is a free tool. To help cover hosting
            and development costs, some links on this site are affiliate links. This
            means we may earn a small commission if you click through and make a
            purchase — at no additional cost to you.
          </p>

          <h3 className="text-lg font-semibold text-gray-900">Amazon Associates</h3>
          <p>
            Big Deck Energy is a participant in the Amazon Services LLC Associates
            Program, an affiliate advertising program designed to provide a means for
            sites to earn advertising fees by advertising and linking to Amazon.com.
            Product recommendations on our{' '}
            <a href="/stuff" className="text-blue-600 hover:text-blue-500 underline">Stuff We Like</a>
            {' '}page contain Amazon affiliate links.
          </p>

          <h3 className="text-lg font-semibold text-gray-900">TCGPlayer Affiliate</h3>
          <p>
            Big Deck Energy is an affiliate partner of TCGPlayer. Card price links in
            generated deck lists and the "Buy on TCGPlayer" button route through our
            TCGPlayer affiliate link. When you purchase cards through these links, we
            earn a small commission at no extra cost to you.
          </p>

          <h3 className="text-lg font-semibold text-gray-900">Editorial Independence</h3>
          <p>
            Affiliate partnerships do not influence deck generation, card
            recommendations, or any algorithmic output of this tool. The deck engine
            selects cards based solely on Commander format rules, synergy scoring, and
            your chosen constraints. We only recommend products we genuinely use or
            believe are useful for Commander players.
          </p>

          <h3 className="text-lg font-semibold text-gray-900">Questions?</h3>
          <p>
            If you have any questions about our affiliate relationships, feel free to
            reach out via our{' '}
            <a href="/contact" className="text-blue-600 hover:text-blue-500 underline">Contact</a>
            {' '}page.
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
              {' '}&bull;{' '}
              <a href="/disclosure" className="text-blue-600 hover:text-blue-500">Disclosure</a>
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
