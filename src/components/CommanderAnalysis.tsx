'use client';

interface CommanderAnalysisProps {
  commanderName: string;
  wantsDescription: string[];
  producesDescription: string[];
  activationDescription: string;
}

export default function CommanderAnalysis({
  commanderName,
  wantsDescription,
  producesDescription,
  activationDescription,
}: CommanderAnalysisProps) {
  if (wantsDescription.length === 0 && producesDescription.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3
        className="text-2xl text-black mb-4"
        style={{ fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase' }}
      >
        Commander Analysis
      </h3>

      <div className="space-y-4">
        {/* Produces */}
        {producesDescription.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-1.5">
              {commanderName} produces:
            </h4>
            <div className="flex flex-wrap gap-2">
              {producesDescription.map((desc, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200"
                >
                  <span className="text-green-500">+</span> {desc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Activation */}
        {activationDescription && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-1.5">
              Activation:
            </h4>
            <p className="text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200 inline-block">
              {activationDescription}
            </p>
          </div>
        )}

        {/* Wants */}
        {wantsDescription.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-1.5">
              {commanderName} wants:
            </h4>
            <div className="flex flex-wrap gap-2">
              {wantsDescription.map((desc, i) => (
                <span
                  key={i}
                  className="inline-flex items-center text-sm font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {desc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
