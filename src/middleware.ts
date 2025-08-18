import { NextRequest, NextResponse } from 'next/server';

// Add your IP addresses here (optional)
const ALLOWED_IPS = [
  '127.0.0.1',
  '::1',
  // Add your home/office IP addresses here
  // '192.168.1.100', // Example home IP
  // '203.0.113.10',  // Example office IP
];

export function middleware(request: NextRequest) {
  // Only apply to admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    
    // Optional: IP restriction (uncomment to enable)
    /*
    const clientIP = request.ip || 
                    request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    if (!ALLOWED_IPS.includes(clientIP) && clientIP !== 'unknown') {
      console.log(`🚫 Admin access denied for IP: ${clientIP}`);
      return new NextResponse('Access Denied', { status: 403 });
    }
    */
    
    // Log admin access attempts
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const clientIP = request.ip || 
                    request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    console.log(`🔐 Admin access attempt: ${request.nextUrl.pathname} from ${clientIP} (${userAgent})`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};