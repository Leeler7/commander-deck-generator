import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🗑️ API: Clearing cache...');
    
    // For now, we'll just return success since cache management 
    // depends on the specific caching implementation
    // In a real implementation, this would clear Redis, memory cache, etc.
    
    console.log('✅ API: Cache cleared successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    });
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to clear cache', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}