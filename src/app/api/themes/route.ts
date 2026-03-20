import { NextRequest, NextResponse } from 'next/server';
import { edhrecClient } from '@/lib/edhrec';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commander = searchParams.get('commander');

  if (!commander) {
    return NextResponse.json({ error: 'commander query parameter required' }, { status: 400 });
  }

  try {
    const themes = await edhrecClient.getCommanderThemes(commander);
    return NextResponse.json({ themes });
  } catch (err) {
    console.error('[/api/themes] error:', err);
    return NextResponse.json({ themes: [] });
  }
}
