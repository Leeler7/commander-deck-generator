import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  try {
    console.log('🔍 Analyzing card name duplicates...');
    
    // Find cards with duplicate names using raw SQL
    const { data: nameDuplicates, error: nameError } = await database.supabase
      .rpc('exec_sql', {
        sql: `
          SELECT name, COUNT(*) as count
          FROM cards 
          GROUP BY name 
          HAVING COUNT(*) > 1 
          ORDER BY COUNT(*) DESC 
          LIMIT 100
        `
      });
    
    if (nameError) {
      throw new Error(`Failed to find duplicates: ${nameError.message}`);
    }
    
    // Get total counts
    const { count: totalCards } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    const { data: uniqueNames } = await database.supabase
      .rpc('exec_sql', {
        sql: 'SELECT DISTINCT name FROM cards'
      });
    
    const duplicateCount = nameDuplicates?.length || 0;
    const uniqueNameCount = uniqueNames?.length || 0;
    const estimatedDuplicates = (totalCards || 0) - uniqueNameCount;
    
    // Get details for top 10 duplicate groups
    let duplicateDetails = [];
    if (nameDuplicates && nameDuplicates.length > 0) {
      for (const duplicate of nameDuplicates.slice(0, 10)) {
        const { data: details } = await database.supabase
          .from('cards')
          .select('id, name, set_name, set, released_at, rarity, created_at')
          .eq('name', duplicate.name)
          .order('released_at', { ascending: false }); // Most recent first
        
        duplicateDetails.push({
          name: duplicate.name,
          count: duplicate.count,
          instances: details || []
        });
      }
    }
    
    return NextResponse.json({
      analysis: {
        totalCards: totalCards || 0,
        uniqueCardNames: uniqueNameCount,
        duplicateGroups: duplicateCount,
        estimatedDuplicateCards: estimatedDuplicates,
        potentialSpaceSaving: `${((estimatedDuplicates / (totalCards || 1)) * 100).toFixed(1)}%`
      },
      topDuplicates: nameDuplicates?.slice(0, 20) || [],
      duplicateDetails: duplicateDetails,
      recommendation: estimatedDuplicates > 1000 ? 
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
    
    // Get all duplicate groups using raw SQL
    const { data: duplicateGroups, error } = await database.supabase
      .rpc('exec_sql', {
        sql: `
          SELECT name, COUNT(*) as count
          FROM cards 
          GROUP BY name 
          HAVING COUNT(*) > 1 
          ORDER BY COUNT(*) DESC
        `
      });
    
    if (error) {
      throw new Error(`Failed to get duplicate groups: ${error.message}`);
    }
    
    console.log(`Found ${duplicateGroups?.length || 0} duplicate groups`);
    
    let deletedCount = 0;
    let processedGroups = 0;
    const deletions = [];
    
    // Process each duplicate group
    for (const group of duplicateGroups || []) {
      try {
        // Get all instances of this card name
        const { data: instances, error: instanceError } = await database.supabase
          .from('cards')
          .select('id, name, set_name, released_at, rarity, created_at')
          .eq('name', group.name)
          .order('released_at', { ascending: false }); // Most recent first
        
        if (instanceError || !instances || instances.length <= 1) {
          continue;
        }
        
        // Keep the most recent version (first in the ordered list)
        const keepCard = instances[0];
        const toDelete = instances.slice(1); // Delete all others
        
        console.log(`📋 ${group.name}: keeping ${keepCard.set_name} (${keepCard.released_at}), deleting ${toDelete.length} others`);
        
        if (!dryRun) {
          // Delete the duplicate cards
          const deleteIds = toDelete.map(card => card.id);
          const { error: deleteError } = await database.supabase
            .from('cards')
            .delete()
            .in('id', deleteIds);
          
          if (deleteError) {
            console.error(`Failed to delete duplicates for ${group.name}:`, deleteError);
          } else {
            deletedCount += toDelete.length;
          }
        } else {
          deletedCount += toDelete.length; // Just count for dry run
        }
        
        deletions.push({
          cardName: group.name,
          kept: {
            id: keepCard.id,
            set: keepCard.set_name,
            released: keepCard.released_at
          },
          deleted: toDelete.map(card => ({
            id: card.id,
            set: card.set_name,
            released: card.released_at
          }))
        });
        
        processedGroups++;
        
        // Process in smaller batches to avoid overwhelming the system
        if (processedGroups % 50 === 0) {
          console.log(`📈 Processed ${processedGroups} groups, ${deletedCount} cards ${dryRun ? 'would be ' : ''}deleted`);
          
          if (!dryRun) {
            // Small delay to prevent overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
      } catch (error) {
        console.error(`Error processing group ${group.name}:`, error);
      }
    }
    
    const { count: finalCount } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    return NextResponse.json({
      success: true,
      dryRun: dryRun,
      results: {
        processedGroups,
        cardsDeleted: deletedCount,
        finalCardCount: finalCount || 0,
        message: dryRun ? 
          `DRY RUN: Would delete ${deletedCount} duplicate cards` :
          `Successfully deleted ${deletedCount} duplicate cards`
      },
      deletions: deletions.slice(0, 20), // First 20 for review
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