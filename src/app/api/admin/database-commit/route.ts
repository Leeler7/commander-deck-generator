import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { message, push = false } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Commit message is required' },
        { status: 400 }
      );
    }
    
    const results = [];
    
    try {
      // Check git status
      const { stdout: statusOutput } = await execAsync('git status --porcelain public/database');
      
      if (!statusOutput.trim()) {
        return NextResponse.json({
          success: false,
          message: 'No changes to commit in public/database'
        });
      }
      
      results.push({ step: 'status', output: statusOutput });
      
      // Stage database files
      const { stdout: addOutput } = await execAsync('git add public/database');
      results.push({ step: 'add', output: addOutput || 'Files staged successfully' });
      
      // Commit changes
      const commitMessage = `${message}\n\n🤖 Generated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
      const { stdout: commitOutput } = await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
      results.push({ step: 'commit', output: commitOutput });
      
      // Optionally push to remote
      if (push) {
        const { stdout: pushOutput } = await execAsync('git push');
        results.push({ step: 'push', output: pushOutput || 'Pushed successfully' });
      }
      
      return NextResponse.json({
        success: true,
        message: push ? 'Database committed and pushed to GitHub' : 'Database committed locally',
        results
      });
      
    } catch (gitError: any) {
      // Check if it's just "nothing to commit"
      if (gitError.message?.includes('nothing to commit')) {
        return NextResponse.json({
          success: false,
          message: 'No changes to commit',
          results
        });
      }
      
      throw gitError;
    }
    
  } catch (error: any) {
    console.error('Git operation failed:', error);
    return NextResponse.json(
      { 
        error: 'Git operation failed', 
        details: error.message || 'Unknown error',
        stderr: error.stderr || ''
      },
      { status: 500 }
    );
  }
}