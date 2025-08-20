import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | Big Deck Energy - Free MTG Commander Deck Generator",
  description: "Frequently asked questions about Big Deck Energy, the free online MTG Commander (EDH) deck generator that builds casual, fun Commander decks instantly.",
  keywords: "MTG Commander FAQ, EDH deck builder questions, Magic the Gathering Commander help, deck generator FAQ",
};

export default function FAQPage() {
  const faqs = [
    {
      question: "Is this a real Commander deck builder?",
      answer: "Yes. Every deck follows official Commander/EDH rules, so you'll always get a 100-card legal list with exactly one commander and 99 other cards including lands."
    },
    {
      question: "Will the decks actually win games?",
      answer: "Probably not. That's the fun part. Big Deck Energy generates casual, chaotic, and intentionally mediocre decks for fun Commander nights with friends."
    },
    {
      question: "What makes Big Deck Energy different from other MTG deck builders?",
      answer: "It's fast, it's free, and it doesn't pretend to be competitive. This is for chaotic casual Commander nights. While other deck builders focus on optimization, BDE embraces the jank."
    },
    {
      question: "How does the MTG Commander deck generator work?",
      answer: "Simply enter any legal legendary creature or planeswalker as your commander, adjust your budget and card type preferences, then click generate. The tool uses the Scryfall API to build a complete 100-card EDH deck instantly."
    },
    {
      question: "Can I use any legendary creature as my commander?",
      answer: "Any legendary creature or planeswalker that's legal in Commander can be used. The generator will automatically match cards to your commander's color identity."
    },
    {
      question: "What's the 'Theme Focus' feature?",
      answer: "Theme Focus lets you prioritize specific mechanics or strategies like tokens, tribal synergies, card draw, or interaction. Cards matching your selected themes get massive synergy bonuses during deck generation."
    },
    {
      question: "Can I export my generated Commander deck?",
      answer: "Yes! You can export your deck in multiple formats including Arena, MTGO, plain text, and Moxfield."
    },
    {
      question: "How accurate are the card prices?",
      answer: "Card prices are pulled directly from the Scryfall API, which aggregates data from major retailers. Prices are updated regularly but may vary slightly from current market prices."
    },
    {
      question: "Is Big Deck Energy free to use?",
      answer: "Completely free. No sign-ups, no subscriptions, no hidden costs. Just (near) instant Commander deck generation whenever you need it."
    },
    {
      question: "Can I save or share my generated decks?",
      answer: "Currently, decks are generated fresh each time. You can export them to your preferred platform (Arena, MTGO, Moxfield) to save them permanently."
    },
    {
      question: "Does the generator consider card synergies?",
      answer: "The generator uses a comprehensive, albiet flawed, tagging system to identify card synergies, mechanics, and interactions. Cards that work well with your commander and theme get prioritized."
    },
    {
      question: "What does 'Build a mediocre deck at instant speed' mean?",
      answer: "This tool generates functional but intentionally non-optimized Commander decks instantly. Perfect for casual games where fun matters more than winning."
    },
      {
      question: "What's the 'Random Deck' button do?",
      answer: "It selects a random legal commander and immediately generates a complete deck for it. Great for when you want maximum chaos or just need inspiration."
    },
    {
      question: "Are the generated decks tournament legal?",
      answer: "The decks follow all Commander/EDH rules and use only legal cards. However, they're designed for casual play, not competitive tournaments. Always check with your playgroup or tournament organizer."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <a href="/" className="inline-block">
              <h1 className="text-5xl text-black hover:text-blue-600 transition-colors" 
                  style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                BIG DECK ENERGY
              </h1>
            </a>
            <p className="mt-2 text-xl text-gray-600"
              style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em'}}>>
              Free MTG Commander (EDH) Deck Generator
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h1 className="text-4xl text-black mb-8"
              style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
            Frequently Asked Questions
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-8">
              Everything you need to know about Big Deck Energy, the free MTG Commander deck generator 
              that embraces chaos and casual fun in EDH.
            </p>
          </div>

          <div className="space-y-8">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-6 last:border-0">
                <h2 className="text-xl text-black mb-3" 
                    style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                  {faq.question}
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-blue-50 rounded-lg">
            <h2 className="text-2xl text-black mb-4"
                style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
              Ready to Generate Your Deck?
            </h2>
            <p className="text-gray-700 mb-6">
              Head back to the main page and start building your next chaotic Commander deck!
            </p>
            <a
              href="/"
              className="inline-block px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}
            >
              GENERATE A DECK
            </a>
          </div>
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
              {' '}•{' '}
              <a href="/faq" className="text-blue-600 hover:text-blue-500">FAQ</a>
              {' '}•{' '}
              <a href="/contact" className="text-blue-600 hover:text-blue-500">Contact</a>
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
