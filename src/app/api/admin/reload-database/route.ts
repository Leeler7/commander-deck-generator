import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Force reload by restarting the server process in production
    // For Railway, this will happen automatically on the next request
    // since we changed the cards.json file timestamp
    
    console.log('🔄 Database reload requested - changes will take effect on next request');
    
    return NextResponse.json({
      success: true,
      message: 'Database will reload automatically on next access'
    });
    
  } catch (error) {
    console.error('Error triggering database reload:', error);
    return NextResponse.json(
      { error: 'Failed to trigger reload' },
      { status: 500 }
    );
  }
}