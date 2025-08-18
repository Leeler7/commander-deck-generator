import { NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET() {
  try {
    console.log('📊 API: Loading system statistics...');
    
    await serverCardDatabase.initialize();
    
    const allCards = serverCardDatabase.getAllCards();
    
    // Generate mock/basic statistics since we don't have real analytics
    const mockStats = {
      database: {
        totalCards: allCards.length,
        commanderCards: allCards.filter(card => 
          card.type_line?.includes('Legendary') && card.type_line?.includes('Creature')
        ).length,
        cardsWithMechanics: allCards.filter(card => 
          card.mechanics && card.mechanics.mechanicTags?.length > 0
        ).length,
        totalTags: 977, // From the available tags analysis
        avgTagsPerCard: 3.2,
        topTags: [
          { name: 'counter', count: 15420 },
          { name: 'create', count: 12340 },
          { name: 'target', count: 11230 },
          { name: 'creature', count: 10450 },
          { name: 'token', count: 8760 },
          { name: 'damage', count: 7890 },
          { name: 'draw', count: 6540 },
          { name: 'sacrifice', count: 5670 }
        ],
        databaseSize: '45.2 MB',
        lastUpdated: new Date().toISOString()
      },
      generation: {
        totalGenerations: 2847,
        avgGenerationTime: 2.34,
        popularCommanders: [
          { name: 'Edgar Markov', count: 156 },
          { name: 'Atraxa, Praetors\' Voice', count: 134 },
          { name: 'The Ur-Dragon', count: 89 },
          { name: 'Korvold, Fae-Cursed King', count: 76 },
          { name: 'Muldrotha, the Gravetide', count: 68 }
        ],
        avgBudget: 127.50,
        successRate: 0.94
      },
      performance: {
        uptime: '2h 34m',
        memoryUsage: '145.2 MB',
        responseTime: 234,
        errorRate: 0.023
      },
      usage: {
        dailyUsers: 47,
        weeklyUsers: 289,
        monthlyUsers: 1156,
        peakHour: '7:00 PM - 8:00 PM',
        topPages: [
          { path: '/', views: 1847 },
          { path: '/admin', views: 234 },
          { path: '/admin/database', views: 89 },
          { path: '/admin/tags', views: 67 },
          { path: '/admin/synergy', views: 45 }
        ]
      }
    };
    
    console.log('✅ API: System statistics loaded');
    
    return NextResponse.json(mockStats);
    
  } catch (error) {
    console.error('Error loading system stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load system stats', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}