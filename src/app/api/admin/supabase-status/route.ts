import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Test connection and get card count
    const { count, error } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Supabase connection error:', error);
      return NextResponse.json({
        connected: false,
        error: error.message
      });
    }
    
    return NextResponse.json({
      connected: true,
      cardCount: count || 0
    });
    
  } catch (error: any) {
    console.error('Failed to check Supabase status:', error);
    return NextResponse.json({
      connected: false,
      error: error.message || 'Unknown error'
    });
  }
}