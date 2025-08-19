import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';
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
    
    await serverCardDatabase.initialize();
    const allCards = serverCardDatabase.getAllCards();
    
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
      // Save the updated database
      const dbPath = path.join(process.cwd(), 'data', 'cards.json');
      
      // Create backup first
      const backupPath = path.join(process.cwd(), 'data', `backup-${Date.now()}-processed-cards.json`);
      try {
        const currentData = await fs.readFile(dbPath, 'utf-8');
        await fs.writeFile(backupPath, currentData);
        console.log(`✅ Backup created at ${backupPath}`);
      } catch (error) {
        console.log('⚠️ Could not create backup, proceeding anyway...');
      }
      
      // Convert cards array to object format that database expects (id -> card)
      const cardObject = {};
      for (const card of allCards) {
        cardObject[card.id] = card;
      }
      
      // Save updated data
      await fs.writeFile(dbPath, JSON.stringify(cardObject, null, 2));
      
      // Note: Cache will be cleared automatically on next database access
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