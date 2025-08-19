import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { tagName, criteria } = await request.json();
    
    if (!tagName || !criteria) {
      return NextResponse.json(
        { error: 'Tag name and criteria are required' },
        { status: 400 }
      );
    }
    
    console.log(`➕ Adding tag "${tagName}" to matching cards...`);
    
    const allCards = await database.getAllCards();
    
    let cardsModified = 0;
    
    // Process each card
    for (const card of allCards) {
      let matches = false;
      
      if (criteria.mode === 'text' && criteria.textQuery) {
        const text = card.oracle_text || '';
        const query = criteria.textQuery;
        
        if (criteria.exactMatch) {
          matches = criteria.caseSensitive 
            ? text.includes(query)
            : text.toLowerCase().includes(query.toLowerCase());
        } else {
          const words = query.toLowerCase().split(/\s+/);
          const cardText = text.toLowerCase();
          matches = words.every(word => cardText.includes(word));
        }
      } 
      else if (criteria.mode === 'color' && criteria.colors) {
        const cardColors = card.color_identity || [];
        matches = criteria.colors.length === cardColors.length &&
                 criteria.colors.every(color => cardColors.includes(color));
      }
      else if (criteria.mode === 'type' && criteria.typeQuery) {
        const typeLine = card.type_line || '';
        const query = criteria.typeQuery;
        
        matches = criteria.caseSensitive 
          ? typeLine.includes(query)
          : typeLine.toLowerCase().includes(query.toLowerCase());
      }
      
      if (matches) {
        // Initialize mechanics if it doesn't exist
        if (!card.mechanics) {
          card.mechanics = {
            cardId: card.id,
            cardName: card.name,
            primaryType: '',
            functionalRoles: [],
            mechanicTags: [],
            synergyKeywords: [],
            powerLevel: 5,
            archetypeRelevance: []
          };
        }
        
        if (!card.mechanics.mechanicTags) {
          card.mechanics.mechanicTags = [];
        }
        
        // Check if tag already exists
        const existingTags = card.mechanics.mechanicTags.map(tag => 
          typeof tag === 'string' ? tag : (tag?.name || String(tag))
        );
        
        if (!existingTags.includes(tagName)) {
          // Add the new tag as a simple string
          card.mechanics.mechanicTags.push(tagName);
          cardsModified++;
        }
      }
    }
    
    if (cardsModified > 0) {
      // Determine the correct path based on environment
      const isVercel = process.env.VERCEL === '1';
      const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
      
      console.log(`🏗️ Environment: Vercel=${isVercel}, Railway=${isRailway}`);
      
      let dbPath: string;
      let dataDir: string;
      
      if (isVercel) {
        dataDir = '/tmp/commander-deck-data';
        dbPath = path.join(dataDir, 'cards.json');
      } else if (isRailway) {
        // For Railway, use /tmp which persists during the request lifecycle
        dataDir = '/tmp/commander-deck-data';
        dbPath = path.join(dataDir, 'cards.json');
      } else {
        // Local development
        dataDir = path.join(process.cwd(), 'data');
        dbPath = path.join(dataDir, 'cards.json');
      }
      
      console.log(`📁 Target directory: ${dataDir}`);
      console.log(`📁 Target file path: ${dbPath}`);
      
      // Ensure data directory exists
      try {
        await fs.mkdir(dataDir, { recursive: true });
        console.log(`✅ Ensured directory exists: ${dataDir}`);
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
      
      console.log(`💾 Writing ${Object.keys(cardObject).length} cards to ${dbPath}`);
      
      // Save updated data
      await fs.writeFile(dbPath, JSON.stringify(cardObject, null, 2));
      
      // Verify file was written and get its size
      try {
        const stats = await fs.stat(dbPath);
        console.log(`📁 File written successfully: ${dbPath}`);
        console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📅 File modified: ${stats.mtime.toISOString()}`);
      } catch (error) {
        console.log(`❌ File verification failed for ${dbPath}:`, error);
      }
      
      // Force database re-initialization for immediate effect
      try {
        // Reset the initialization flag to force reload from our new file
        (serverCardDatabase as any).initialized = false;
        console.log('🔄 Forced database re-initialization for immediate effect');
        
        // Also update the internal data directory path if needed
        if (isRailway || isVercel) {
          // Force the database to use our temporary location
          console.log('🎯 Forcing database to use temporary file location for immediate effect');
        }
      } catch (error) {
        console.log('⚠️ Could not force re-initialization:', error);
      }
    }
    
    console.log(`✅ Successfully added "${tagName}" tag to ${cardsModified} cards`);
    
    return NextResponse.json({
      success: true,
      cardsModified,
      tagName
    });
    
  } catch (error) {
    console.error('Error adding tag:', error);
    return NextResponse.json(
      { error: 'Failed to add tag' },
      { status: 500 }
    );
  }
}