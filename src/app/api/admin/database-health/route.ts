import { NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function GET() {
  try {
    console.log('🏥 API: Running database health check...');
    
    const allCards = await database.getAllCards();
    const totalCards = allCards.length;
    const validCards = allCards.filter(card => card.name && card.type_line).length;
    const cardsWithMechanics = allCards.filter(card => card.mechanics && card.mechanics.mechanicTags?.length > 0).length;
    
    // Calculate rough database size
    const dbSizeBytes = JSON.stringify(allCards).length;
    const dbSizeMB = (dbSizeBytes / (1024 * 1024)).toFixed(2);
    const databaseSize = `${dbSizeMB} MB (estimated)`;
    
    console.log(`✅ API: Health check completed - ${totalCards} total, ${validCards} valid, ${cardsWithMechanics} with mechanics`);
    
    return NextResponse.json({
      totalCards,
      validCards,
      cardsWithMechanics,
      databaseSize,
      healthScore: Math.round((validCards / totalCards) * 100),
      lastChecked: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error running health check:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run health check', 
        details: error instanceof Error ? error.message : 'Unknown error',
        totalCards: 0,
        validCards: 0,
        cardsWithMechanics: 0,
        databaseSize: '0 MB',
        healthScore: 0
      },
      { status: 500 }
    );
  }
}