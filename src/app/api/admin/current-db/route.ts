import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbType = process.env.DATABASE_TYPE || 'file';
    
    return NextResponse.json({
      currentDatabase: dbType,
      isProduction: process.env.NODE_ENV === 'production',
      environmentSource: process.env.DATABASE_TYPE ? 'environment' : 'default'
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}