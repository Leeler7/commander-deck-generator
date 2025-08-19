import { NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function GET() {
  try {
    const dbType = process.env.DATABASE_TYPE || 'file';
    const dbInstance = database.constructor.name;
    
    // Try to get some stats
    let stats = null;
    try {
      if ('stats' in database) {
        stats = (database as any).stats();
      }
    } catch (e) {
      stats = { error: 'No stats method available' };
    }

    return NextResponse.json({
      currentDatabaseType: dbType,
      databaseInstance: dbInstance,
      environmentVars: {
        DATABASE_TYPE: process.env.DATABASE_TYPE,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT_SET',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET'
      },
      stats
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}