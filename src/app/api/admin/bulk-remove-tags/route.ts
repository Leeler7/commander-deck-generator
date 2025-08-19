import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json();
    
    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Invalid tags array' },
        { status: 400 }
      );
    }
    
    console.log(`🗑️ Removing ${tags.length} tags from database...`);
    
    const allCards = await database.getAllCards();
    
    let cardsModified = 0;
    let tagsRemoved = 0;
    
    // Process each card
    for (const card of allCards) {
      if (card.mechanics?.mechanicTags && card.mechanics.mechanicTags.length > 0) {
        const originalLength = card.mechanics.mechanicTags.length;
        
        // Filter out the tags to be removed
        card.mechanics.mechanicTags = card.mechanics.mechanicTags.filter(tag => {
          const tagName = typeof tag === 'string' ? tag : (tag?.name || String(tag));
          return !tags.includes(tagName);
        });
        
        // If tags were removed, count it
        if (card.mechanics.mechanicTags.length < originalLength) {
          cardsModified++;
          tagsRemoved += originalLength - card.mechanics.mechanicTags.length;
        }
      }
    }
    
    // Determine the correct path based on environment
    const isVercel = process.env.VERCEL === '1';
    const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
    
    let dbPath: string;
    let dataDir: string;
    
    if (isVercel || isRailway) {
      dataDir = '/tmp/commander-deck-data';
      dbPath = path.join(dataDir, 'cards.json');
    } else {
      // Local development
      dataDir = path.join(process.cwd(), 'data');
      dbPath = path.join(dataDir, 'cards.json');
    }
    
    // Ensure data directory exists
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      console.log(`⚠️ Could not create directory ${dataDir}:`, error);
    }
    
    // Create backup first (if file exists)
    const backupPath = path.join(dataDir, `backup-${Date.now()}-cards.json`);
    try {
      const currentData = await fs.readFile(dbPath, 'utf-8');
      await fs.writeFile(backupPath, currentData);
      console.log(`✅ Backup created at ${backupPath}`);
    } catch (error) {
      console.log('⚠️ Could not create backup (file may not exist), proceeding anyway...');
    }
    
    // Convert cards array to object format that database expects (id -> card)
    const cardObject = {};
    for (const card of allCards) {
      cardObject[card.id] = card;
    }
    
    // Save updated data
    await fs.writeFile(dbPath, JSON.stringify(cardObject, null, 2));
    
    // Force database re-initialization for immediate effect
    try {
      const { serverCardDatabase } = await import('@/lib/server-card-database');
      (serverCardDatabase as any).initialized = false;
      console.log('🔄 Forced database re-initialization for immediate effect');
    } catch (error) {
      console.log('⚠️ Could not force re-initialization:', error);
    }
    
    // Note: Cache will be cleared automatically on next database access
    
    console.log(`✅ Successfully removed ${tagsRemoved} tag instances from ${cardsModified} cards`);
    
    return NextResponse.json({
      success: true,
      cardsModified,
      tagsRemoved,
      tagsRequested: tags.length
    });
    
  } catch (error) {
    console.error('Error removing tags:', error);
    return NextResponse.json(
      { error: 'Failed to remove tags' },
      { status: 500 }
    );
  }
}