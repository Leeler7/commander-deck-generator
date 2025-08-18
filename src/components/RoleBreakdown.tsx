'use client';

import { CardRole } from '@/lib/types';

interface RoleBreakdownProps {
  roleBreakdown: Record<string, number>;
  totalCards: number;
}

export default function RoleBreakdown({ roleBreakdown, totalCards }: RoleBreakdownProps) {
  const roles = Object.entries(roleBreakdown).filter(([_, count]) => count > 0);
  
  const roleColors: Record<string, { bg: string; border: string }> = {
    'commander': { bg: 'bg-purple-500', border: 'border-purple-500' },
    'Commander': { bg: 'bg-purple-500', border: 'border-purple-500' },
    'land': { bg: 'bg-yellow-500', border: 'border-yellow-500' },
    'Land': { bg: 'bg-yellow-500', border: 'border-yellow-500' },
    'ramp': { bg: 'bg-green-500', border: 'border-green-500' },
    'Ramp': { bg: 'bg-green-500', border: 'border-green-500' },
    'draw': { bg: 'bg-blue-500', border: 'border-blue-500' },
    'Draw/Advantage': { bg: 'bg-blue-500', border: 'border-blue-500' },
    'removal': { bg: 'bg-red-500', border: 'border-red-500' },
    'Removal/Interaction': { bg: 'bg-red-500', border: 'border-red-500' },
    'boardWipe': { bg: 'bg-orange-500', border: 'border-orange-500' },
    'Board Wipe': { bg: 'bg-orange-500', border: 'border-orange-500' },
    'tutor': { bg: 'bg-indigo-500', border: 'border-indigo-500' },
    'Tutor': { bg: 'bg-indigo-500', border: 'border-indigo-500' },
    'protection': { bg: 'bg-emerald-500', border: 'border-emerald-500' },
    'Protection': { bg: 'bg-emerald-500', border: 'border-emerald-500' },
    'synergy': { bg: 'bg-pink-500', border: 'border-pink-500' },
    'Synergy/Wincon': { bg: 'bg-pink-500', border: 'border-pink-500' },
    'wincon': { bg: 'bg-pink-600', border: 'border-pink-600' },
    'artifact': { bg: 'bg-gray-500', border: 'border-gray-500' },
    'creature': { bg: 'bg-green-600', border: 'border-green-600' },
    'enchantment': { bg: 'bg-purple-600', border: 'border-purple-600' },
    'instant': { bg: 'bg-blue-600', border: 'border-blue-600' },
    'sorcery': { bg: 'bg-red-600', border: 'border-red-600' },
    'planeswalker': { bg: 'bg-indigo-600', border: 'border-indigo-600' }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Deck Composition</h3>
      
      {/* Visual Bar Chart */}
      <div className="space-y-3 mb-6">
        {roles.map(([role, count]) => {
          const percentage = (count / totalCards) * 100;
          const colors = roleColors[role] || { bg: 'bg-gray-400', border: 'border-gray-400' };
          
          return (
            <div key={role} className="flex items-center">
              <div className="w-24 text-sm text-gray-600 truncate">
                {role}
              </div>
              <div className="flex-1 mx-3">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${colors.bg} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-sm text-gray-900 text-right">
                {count} ({percentage.toFixed(1)}%)
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {roles.map(([role, count]) => {
          const colors = roleColors[role] || { bg: 'bg-gray-400', border: 'border-gray-400' };
          
          return (
            <div key={role} className="text-center">
              <div className={`w-8 h-8 rounded-full ${colors.bg} mx-auto mb-2`} />
              <div className="text-xs text-gray-600 truncate">{role}</div>
              <div className="text-lg font-semibold text-gray-900">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalCards}</div>
            <div className="text-sm text-gray-600">Total Cards</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {roleBreakdown.land || roleBreakdown.Land || 0}
            </div>
            <div className="text-sm text-gray-600">Lands</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {totalCards - (roleBreakdown.land || roleBreakdown.Land || 0)}
            </div>
            <div className="text-sm text-gray-600">Non-Lands</div>
          </div>
        </div>
      </div>
    </div>
  );
}