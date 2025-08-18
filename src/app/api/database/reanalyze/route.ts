import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function POST(request: NextRequest) {
  try {
    await serverCardDatabase.initialize();
    
    // Check if database has cards
    const status = serverCardDatabase.getStatus();
    if (status.total_cards === 0) {
      return NextResponse.json(
        { error: 'No cards in database to re-analyze. Please sync database first.' },
        { status: 400 }
      );
    }

    // Start re-analysis (this will take a while)
    console.log('🔄 Starting comprehensive re-analysis of all cards...');
    await serverCardDatabase.reAnalyzeAllCards();
    
    const finalStatus = serverCardDatabase.getStatus();
    
    return NextResponse.json({
      success: true,
      message: `Successfully re-analyzed ${finalStatus.total_cards} cards with comprehensive tagging system`,
      totalCards: finalStatus.total_cards,
      completedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error during re-analysis:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to re-analyze cards', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await serverCardDatabase.initialize();
    
    const status = serverCardDatabase.getStatus();
    
    return NextResponse.json({
      message: 'Database re-analysis endpoint',
      currentStatus: status,
      instructions: 'Send POST request to start comprehensive re-analysis of all cards',
      warning: 'This operation will take a significant amount of time for large databases'
    });
    
  } catch (error) {
    console.error('Error checking database status:', error);
    
    return NextResponse.json(
      { error: 'Failed to check database status' },
      { status: 500 }
    );
  }
}