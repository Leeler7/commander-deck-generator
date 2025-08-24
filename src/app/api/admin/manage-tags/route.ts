import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-updated';

interface TagData {
  id?: number;
  name: string;
  category: string;
  description?: string;
  synergy_weight: number;
  is_active: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active_only = searchParams.get('active_only') === 'true';

    let query = supabase
      .from('tags')
      .select('*')
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    if (active_only) {
      query = query.eq('is_active', true);
    }

    const { data: tags, error } = await query;

    if (error) {
      throw error;
    }

    // Get usage counts for each tag
    const tagsWithCounts = await Promise.all(
      (tags || []).map(async (tag) => {
        const { count } = await supabase
          .from('card_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tag.id);

        return {
          ...tag,
          usage_count: count || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      tags: tagsWithCounts,
      total: tagsWithCounts.length
    });

  } catch (error) {
    console.error('Error fetching tags:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, description, synergy_weight, is_active } = body as TagData;

    if (!name || !category || synergy_weight === undefined) {
      return NextResponse.json(
        { error: 'Name, category, and synergy_weight are required' },
        { status: 400 }
      );
    }

    // Check if tag already exists
    const { data: existing, error: checkError } = await supabase
      .from('tags')
      .select('id')
      .eq('name', name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 409 }
      );
    }

    // Create new tag
    const { data: newTag, error: createError } = await supabase
      .from('tags')
      .insert({
        name,
        category,
        description,
        synergy_weight,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return NextResponse.json({
      success: true,
      tag: newTag,
      message: 'Tag created successfully'
    });

  } catch (error) {
    console.error('Error creating tag:', error);
    
    return NextResponse.json(
      { error: 'Failed to create tag', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, category, description, synergy_weight, is_active } = body as TagData;

    if (!id || !name || !category || synergy_weight === undefined) {
      return NextResponse.json(
        { error: 'ID, name, category, and synergy_weight are required' },
        { status: 400 }
      );
    }

    // Update tag
    const { data: updatedTag, error: updateError } = await supabase
      .from('tags')
      .update({
        name,
        category,
        description,
        synergy_weight,
        is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      tag: updatedTag,
      message: 'Tag updated successfully'
    });

  } catch (error) {
    console.error('Error updating tag:', error);
    
    return NextResponse.json(
      { error: 'Failed to update tag', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Check if tag is in use
    const { count } = await supabase
      .from('card_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', parseInt(id));

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete tag: it is used by ${count} card relationships` },
        { status: 409 }
      );
    }

    // Delete tag
    const { error: deleteError } = await supabase
      .from('tags')
      .delete()
      .eq('id', parseInt(id));

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting tag:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete tag', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}