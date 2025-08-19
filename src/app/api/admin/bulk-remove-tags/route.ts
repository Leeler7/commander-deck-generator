import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';
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
    
    await serverCardDatabase.initialize();
    const allCards = serverCardDatabase.getAllCards();
    
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
    
    // Save the updated database
    const dbPath = path.join(process.cwd(), 'data', 'processed-cards.json');
    
    // Create backup first
    const backupPath = path.join(process.cwd(), 'data', `backup-${Date.now()}-processed-cards.json`);
    try {
      const currentData = await fs.readFile(dbPath, 'utf-8');
      await fs.writeFile(backupPath, currentData);
      console.log(`✅ Backup created at ${backupPath}`);
    } catch (error) {
      console.log('⚠️ Could not create backup, proceeding anyway...');
    }
    
    // Save updated data
    await fs.writeFile(dbPath, JSON.stringify(allCards, null, 2));
    
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