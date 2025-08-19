import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BLACKLIST_FILE = path.join(process.cwd(), 'data', 'tag-blacklist.json');

// Default blacklist
const DEFAULT_BLACKLIST = [
  'cast', 'target', 'creature', 'spell', 'card', 'play', 'turn', 'mana',
  'control', 'battlefield', 'graveyard', 'library', 'hand', 'zone'
];

export async function GET() {
  try {
    // Try to read existing blacklist
    try {
      const data = await fs.readFile(BLACKLIST_FILE, 'utf-8');
      const blacklist = JSON.parse(data);
      return NextResponse.json({ blacklist });
    } catch (error) {
      // If file doesn't exist, return default
      return NextResponse.json({ blacklist: DEFAULT_BLACKLIST });
    }
  } catch (error) {
    console.error('Error reading blacklist:', error);
    return NextResponse.json(
      { error: 'Failed to load blacklist' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { blacklist } = await request.json();
    
    if (!Array.isArray(blacklist)) {
      return NextResponse.json(
        { error: 'Blacklist must be an array' },
        { status: 400 }
      );
    }
    
    // Ensure data directory exists
    const dataDir = path.dirname(BLACKLIST_FILE);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    // Save blacklist
    await fs.writeFile(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
    
    console.log(`✅ Saved tag blacklist with ${blacklist.length} entries`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Blacklist saved with ${blacklist.length} tags` 
    });
    
  } catch (error) {
    console.error('Error saving blacklist:', error);
    return NextResponse.json(
      { error: 'Failed to save blacklist' },
      { status: 500 }
    );
  }
}

// Function to apply blacklist to cards (used by sync)
export async function applyBlacklistToCards(cards: any[]): Promise<{ cardsModified: number, tagsRemoved: number }> {
  let blacklist = DEFAULT_BLACKLIST;
  
  // Try to load custom blacklist
  try {
    const data = await fs.readFile(BLACKLIST_FILE, 'utf-8');
    blacklist = JSON.parse(data);
  } catch {
    // Use default if file doesn't exist
  }
  
  let cardsModified = 0;
  let tagsRemoved = 0;
  
  for (const card of cards) {
    if (card.mechanics?.mechanicTags && card.mechanics.mechanicTags.length > 0) {
      const originalLength = card.mechanics.mechanicTags.length;
      
      // Filter out blacklisted tags
      card.mechanics.mechanicTags = card.mechanics.mechanicTags.filter((tag: any) => {
        const tagName = typeof tag === 'string' ? tag : (tag?.name || String(tag));
        return !blacklist.includes(tagName);
      });
      
      if (card.mechanics.mechanicTags.length < originalLength) {
        cardsModified++;
        tagsRemoved += originalLength - card.mechanics.mechanicTags.length;
      }
    }
  }
  
  if (tagsRemoved > 0) {
    console.log(`🚫 Auto-removed ${tagsRemoved} blacklisted tags from ${cardsModified} cards`);
  }
  
  return { cardsModified, tagsRemoved };
}