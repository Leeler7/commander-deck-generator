import { NextResponse } from 'next/server';
import { SupabaseCardDatabase } from '@/lib/supabase-updated';

export async function GET() {
  try {
    const database = new SupabaseCardDatabase();
    const categories = await database.getTagCategories();
    
    // Convert category names to plain language
    const formatCategoryName = (category: string): string => {
      return category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    };
    
    const formattedCategories = categories.map(category => ({
      value: category,
      label: formatCategoryName(category)
    }));
    
    return NextResponse.json({ categories: formattedCategories });
  } catch (error) {
    console.error('Error getting tag categories:', error);
    return NextResponse.json(
      { error: 'Failed to get tag categories' },
      { status: 500 }
    );
  }
}