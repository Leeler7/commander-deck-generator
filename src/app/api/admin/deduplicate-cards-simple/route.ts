import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  try {
    console.log('🔍 Analyzing card name duplicates (simple approach)...');
    
    // Get all cards with pagination
    let allCards: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    console.log('📦 Fetching all cards with pagination...');
    
    while (true) {
      const { data: pageCards, error: cardsError } = await database.supabase
        .from('cards')
        .select('id, name, set_name')
        .order('name')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (cardsError) {
        throw new Error(`Failed to fetch cards (page ${page + 1}): ${cardsError.message}`);
      }
      
      if (!pageCards || pageCards.length === 0) {
        break; // No more cards
      }
      
      allCards.push(...pageCards);
      page++;
      
      console.log(`📄 Fetched page ${page}, total cards so far: ${allCards.length}`);
      
      // If we got less than pageSize, we're done
      if (pageCards.length < pageSize) {
        break;
      }
    }
    
    console.log(`✅ Fetched ${allCards.length} total cards`);
    
    // Process duplicates in JavaScript
    const nameGroups: { [key: string]: any[] } = {};
    
    for (const card of allCards || []) {
      if (!nameGroups[card.name]) {
        nameGroups[card.name] = [];
      }
      nameGroups[card.name].push(card);
    }
    
    // Find duplicates
    const duplicateGroups = Object.entries(nameGroups)
      .filter(([name, cards]) => cards.length > 1)
      .map(([name, cards]) => ({
        name,
        count: cards.length,
        instances: cards.sort((a, b) => a.set_name.localeCompare(b.set_name))
      }))
      .sort((a, b) => b.count - a.count);
    
    const totalCards = allCards?.length || 0;
    const uniqueNames = Object.keys(nameGroups).length;
    const duplicateCards = totalCards - uniqueNames;
    
    return NextResponse.json({
      analysis: {
        totalCards,
        uniqueCardNames: uniqueNames,
        duplicateGroups: duplicateGroups.length,
        estimatedDuplicateCards: duplicateCards,
        potentialSpaceSaving: `${((duplicateCards / totalCards) * 100).toFixed(1)}%`
      },
      topDuplicates: duplicateGroups.slice(0, 20).map(group => ({
        name: group.name,
        count: group.count
      })),
      duplicateDetails: duplicateGroups.slice(0, 10),
      recommendation: duplicateCards > 1000 ? 
        'Significant space savings possible - recommend deduplication' :
        'Minimal duplicates found',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error analyzing duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to analyze duplicates: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: any) {
  try {
    const { dryRun = true } = await request.json().catch(() => ({ dryRun: true }));
    
    console.log(`🧹 Starting deduplication (dryRun: ${dryRun})...`);
    
    // Get all cards with pagination
    let allCards: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    console.log('📦 Fetching all cards with pagination for deduplication...');
    
    while (true) {
      const { data: pageCards, error: cardsError } = await database.supabase
        .from('cards')
        .select('id, name, set_name')
        .order('name')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (cardsError) {
        throw new Error(`Failed to fetch cards (page ${page + 1}): ${cardsError.message}`);
      }
      
      if (!pageCards || pageCards.length === 0) {
        break; // No more cards
      }
      
      allCards.push(...pageCards);
      page++;
      
      console.log(`📄 Fetched page ${page}, total cards so far: ${allCards.length}`);
      
      if (pageCards.length < pageSize) {
        break;
      }
    }
    
    console.log(`✅ Fetched ${allCards.length} total cards for deduplication`);
    
    // Group by name
    const nameGroups: { [key: string]: any[] } = {};
    for (const card of allCards || []) {
      if (!nameGroups[card.name]) {
        nameGroups[card.name] = [];
      }
      nameGroups[card.name].push(card);
    }
    
    // Find duplicates and prepare for deletion
    let deletedCount = 0;
    let processedGroups = 0;
    const deletions = [];
    
    for (const [name, cards] of Object.entries(nameGroups)) {
      if (cards.length <= 1) continue;
      
      // Sort by set name (alphabetical - keep first alphabetically)
      const sorted = cards.sort((a, b) => a.set_name.localeCompare(b.set_name));
      
      const keepCard = sorted[0]; // Keep most recent
      const toDelete = sorted.slice(1); // Delete others
      
      console.log(`📋 ${name}: keeping ${keepCard.set_name}, deleting ${toDelete.length} others`);
      
      // Debug: Show what we're trying to delete
      if (toDelete.length > 0) {
        console.log(`  First duplicate to delete: name="${toDelete[0].name}", set_name="${toDelete[0].set_name}"`);
        console.log(`  Card to keep: name="${keepCard.name}", set_name="${keepCard.set_name}"`);
      }
      
      if (!dryRun) {
        // Simple and efficient: delete by IDs
        const deleteIds = toDelete.map(card => card.id);
        
        console.log(`🗑️ Deleting ${deleteIds.length} duplicate(s) of "${name}"`);
        
        // Batch delete all duplicates at once using their IDs
        const { data, error: deleteError } = await database.supabase
          .from('cards')
          .delete()
          .in('id', deleteIds)
          .select();
        
        if (deleteError) {
          console.error(`❌ Failed to delete duplicates of "${name}":`, deleteError);
        } else if (data && data.length > 0) {
          console.log(`✅ Successfully deleted ${data.length} duplicate(s) of "${name}"`);
          deletedCount += data.length;
        } else {
          console.log(`⚠️ No rows were deleted for "${name}" - IDs may not exist`);
        }
      } else {
        deletedCount += toDelete.length;
      }
      
      deletions.push({
        cardName: name,
        kept: {
          id: keepCard.id,
          set: keepCard.set_name
        },
        deleted: toDelete.map(card => ({
          id: card.id,
          set: card.set_name
        }))
      });
      
      processedGroups++;
      
      if (processedGroups % 10 === 0) {
        console.log(`📈 Processed ${processedGroups} groups`);
        if (!dryRun) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    const { count: finalCount } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    return NextResponse.json({
      success: true,
      dryRun,
      results: {
        processedGroups,
        cardsDeleted: deletedCount,
        finalCardCount: finalCount || 0,
        message: dryRun ? 
          `DRY RUN: Would delete ${deletedCount} duplicate cards` :
          `Successfully deleted ${deletedCount} duplicate cards`
      },
      deletions: deletions.slice(0, 20),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in deduplication:', error);
    return NextResponse.json(
      { error: 'Deduplication failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}