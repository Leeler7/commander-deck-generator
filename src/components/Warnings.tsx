'use client';

interface DashboardWarning {
  id: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

interface WarningsProps {
  warnings: string[];
  notes: string[];
  dashboardWarnings?: DashboardWarning[];
}

// Per-severity styling. error = red, warn = amber, info = blue.
const SEVERITY_STYLES: Record<DashboardWarning['severity'], { box: string; dot: string; label: string }> = {
  error: { box: 'bg-red-50 border-red-200 text-red-800', dot: 'bg-red-500', label: 'Error' },
  warn: { box: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500', label: 'Warning' },
  info: { box: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-500', label: 'Note' },
};

const SEVERITY_ORDER: Record<DashboardWarning['severity'], number> = { error: 0, warn: 1, info: 2 };

export default function Warnings({ warnings, notes, dashboardWarnings }: WarningsProps) {
  void notes; // notes are intentionally not rendered here

  const structured = (dashboardWarnings ?? [])
    .slice()
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (structured.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Structured, severity-tagged deck-health warnings */}
      {structured.map((w) => {
        const s = SEVERITY_STYLES[w.severity];
        return (
          <div key={w.id} className={`flex items-center gap-3 rounded-lg border p-3 ${s.box}`}>
            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide opacity-70 w-16 flex-shrink-0">{s.label}</span>
            <span className="text-sm">{w.message}</span>
          </div>
        );
      })}

      {/* Flat generation warnings (legality, budget, gap messages) */}
      {warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Deck Generation Warnings
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={`warning-${index}-${warning.slice(0, 20)}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
