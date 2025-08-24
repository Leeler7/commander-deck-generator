import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  try {
    console.log('🔍 Checking database activity...');
    
    // Check recent insertions in last few minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentCards, error: recentError } = await database.supabase
      .from('cards')
      .select('id, name, created_at')
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Get total count
    const { count: totalCards, error: countError } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    // Check for cards without tag_ids (being processed)
    const { count: untaggedCount, error: untaggedError } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .is('tag_ids', null);
    
    return NextResponse.json({
      totalCards: totalCards || 0,
      recentCards: recentCards || [],
      recentCardsCount: recentCards?.length || 0,
      untaggedCards: untaggedCount || 0,
      timestamp: new Date().toISOString(),
      errors: {
        recent: recentError?.message || null,
        count: countError?.message || null,
        untagged: untaggedError?.message || null
      }
    });
    
  } catch (error) {
    console.error('Error checking activity:', error);
    return NextResponse.json(
      { error: 'Failed to check activity: ' + (error as Error).message },
      { status: 500 }
    );
  }
}