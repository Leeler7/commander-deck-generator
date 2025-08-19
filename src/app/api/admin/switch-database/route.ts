import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { databaseType } = await request.json();
    
    if (!['file', 'supabase'].includes(databaseType)) {
      return NextResponse.json(
        { error: 'Invalid database type. Must be "file" or "supabase"' },
        { status: 400 }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      return NextResponse.json({
        success: false,
        error: 'Database switching in production requires setting DATABASE_TYPE environment variable in Railway dashboard',
        instructions: [
          '1. Go to Railway dashboard',
          '2. Select your project',
          '3. Go to Variables tab', 
          '4. Add: DATABASE_TYPE = ' + databaseType,
          '5. Restart the service'
        ]
      }, { status: 400 });
    }
    
    // Development environment - update .env.local file
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update DATABASE_TYPE in environment file
    const lines = envContent.split('\n');
    let updated = false;
    
    const newLines = lines.map(line => {
      if (line.startsWith('DATABASE_TYPE=')) {
        updated = true;
        return `DATABASE_TYPE=${databaseType}`;
      }
      return line;
    });
    
    // If DATABASE_TYPE wasn't found, add it
    if (!updated) {
      newLines.push('', '# Database Configuration');
      newLines.push(`DATABASE_TYPE=${databaseType}`);
    }
    
    // Write back to file
    fs.writeFileSync(envPath, newLines.join('\n'));
    
    // Update process environment for immediate effect
    process.env.DATABASE_TYPE = databaseType;
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully switched to ${databaseType} database` 
    });
    
  } catch (error: any) {
    console.error('Failed to switch database:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to switch database' },
      { status: 500 }
    );
  }
}