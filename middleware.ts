import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // The set method is called when the supabase client needs to update the session
          // This is important for maintaining auth state across requests
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          // The remove method is called when the supabase client needs to clear the session
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  console.log('Middleware - Path:', request.nextUrl.pathname);
  console.log('Middleware - Cookies:', request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 20)}...`));
  console.log('Middleware - User:', user ? 'Authenticated' : 'Not authenticated');

  // If user is not signed in and the current path is protected, redirect to sign in page
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    console.log('Middleware - Redirecting to sign in (no user)');
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  // If user is signed in and tries to access auth pages, redirect to dashboard
  if (user && (
    request.nextUrl.pathname.startsWith('/auth/signin') ||
    request.nextUrl.pathname.startsWith('/auth/signup')
  )) {
    console.log('Middleware - Redirecting to dashboard (user authenticated)');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};