import { NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET() {
  try {
    console.log('📋 API: Exporting system statistics...');
    
    await serverCardDatabase.initialize();
    
    const allCards = serverCardDatabase.getAllCards();
    
    // Generate comprehensive export data
    const exportData = {
      exportDate: new Date().toISOString(),
      database: {
        totalCards: allCards.length,
        cardsBySet: allCards.reduce((acc: Record<string, number>, card) => {
          const setCode = card.set_code || 'unknown';
          acc[setCode] = (acc[setCode] || 0) + 1;
          return acc;
        }, {}),
        cardsByType: allCards.reduce((acc: Record<string, number>, card) => {
          const primaryType = card.type_line.split(' ')[0] || 'unknown';
          acc[primaryType] = (acc[primaryType] || 0) + 1;
          return acc;
        }, {}),
        cardsWithMechanics: allCards.filter(card => 
          card.mechanics && card.mechanics.mechanicTags?.length > 0
        ).length
      },
      performance: {
        exportTime: Date.now(),
        databaseLoadTime: 'N/A',
        memoryUsage: process.memoryUsage ? process.memoryUsage() : 'N/A'
      }
    };
    
    console.log('✅ API: Statistics exported successfully');
    
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="system-stats-${new Date().toISOString().split('T')[0]}.json"`
      }
    });
    
  } catch (error) {
    console.error('Error exporting stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to export stats', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}