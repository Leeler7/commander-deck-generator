import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for the latest sync report
// In a real system, you'd store this in a database
let lastSyncReport: any = null;

export async function POST(request: NextRequest) {
  try {
    const report = await request.json();
    
    // Store the sync report
    lastSyncReport = {
      ...report,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json({
      success: true,
      message: 'Sync report stored'
    });
    
  } catch (error) {
    console.error('❌ Failed to store sync report:', error);
    return NextResponse.json(
      { error: 'Failed to store sync report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    
    if (!lastSyncReport) {
      return NextResponse.json(
        { error: 'No sync report available' },
        { status: 404 }
      );
    }
    
    if (format === 'csv') {
      // Generate CSV format for new cards
      const csvLines = ['Name,Set,Set Name,Rarity,Type,Release Date,Scryfall URL'];
      
      if (lastSyncReport.newCards) {
        lastSyncReport.newCards.forEach((card: any) => {
          csvLines.push([
            card.name,
            card.set,
            card.set_name,
            card.rarity,
            card.type_line,
            card.released_at,
            card.scryfall_uri
          ].map(field => `"${field}"`).join(','));
        });
      }
      
      const csvContent = csvLines.join('\n');
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="sync-report-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
    
    // Default JSON format
    return NextResponse.json(lastSyncReport);
    
  } catch (error) {
    console.error('❌ Failed to get sync report:', error);
    return NextResponse.json(
      { error: 'Failed to get sync report' },
      { status: 500 }
    );
  }
}