import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  try {
    console.log('🔍 Checking for duplicate cards...');
    
    // Check for cards with duplicate IDs (exact duplicates)
    const { data: exactDuplicates, error: exactError } = await database.supabase
      .from('cards')
      .select('id, name, set_name, released_at, count(*)')
      .group('id, name, set_name, released_at')
      .having('count(*) > 1')
      .order('count', { ascending: false })
      .limit(50);
    
    // Check for cards with same name but different IDs (potential reprints that should be unique)
    const { data: nameDuplicates, error: nameError } = await database.supabase
      .from('cards')
      .select('name, count(*)')
      .group('name')
      .having('count(*) > 1')
      .order('count', { ascending: false })
      .limit(50);
    
    // Get total card count
    const { count: totalCards, error: countError } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    // Check for cards with same name - get details for top duplicates
    let duplicateDetails = [];
    if (nameDuplicates && nameDuplicates.length > 0) {
      for (const duplicate of nameDuplicates.slice(0, 5)) {
        const { data: details } = await database.supabase
          .from('cards')
          .select('id, name, set_name, released_at, created_at')
          .eq('name', duplicate.name)
          .order('created_at', { ascending: false });
        
        duplicateDetails.push({
          name: duplicate.name,
          count: duplicate.count,
          instances: details || []
        });
      }
    }
    
    // Check recent insertions to see timing patterns
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentCards, error: recentError } = await database.supabase
      .from('cards')
      .select('id, name, created_at')
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      summary: {
        totalCards: totalCards || 0,
        exactDuplicates: exactDuplicates?.length || 0,
        nameDuplicates: nameDuplicates?.length || 0,
        recentInsertions: recentCards?.length || 0
      },
      duplicates: {
        exactDuplicates: exactDuplicates || [],
        nameDuplicates: nameDuplicates || [],
        duplicateDetails: duplicateDetails,
        recentCards: recentCards || []
      },
      errors: {
        exactError: exactError?.message || null,
        nameError: nameError?.message || null,
        countError: countError?.message || null,
        recentError: recentError?.message || null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to check duplicates: ' + (error as Error).message },
      { status: 500 }
    );
  }
}