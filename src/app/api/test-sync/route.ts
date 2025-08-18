import { NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET() {
  try {
    console.log('🧪 TEST: Starting database test...');
    
    // Initialize database
    await serverCardDatabase.initialize();
    console.log('✅ Database initialized');
    
    // Check current card count
    const currentCards = serverCardDatabase.getAllCards();
    console.log(`📊 Current cards: ${currentCards.length}`);
    
    // Check if sync is needed
    const needsSync = serverCardDatabase.needsSync();
    console.log(`🔄 Needs sync: ${needsSync}`);
    
    // Get status
    const status = serverCardDatabase.getStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Database test completed',
      cardCount: currentCards.length,
      needsSync,
      status,
      environment: process.env.VERCEL === '1' ? 'Vercel' : 'Local',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}