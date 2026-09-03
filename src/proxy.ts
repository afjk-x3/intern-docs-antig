import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

export async function proxy(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              supabaseResponse.cookies.set(name, value, options);
            });
          } catch {
            // Ignored in middleware
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Idle timeout logic
  const now = Date.now();
  const lastActiveStr = request.cookies.get('last_active')?.value;
  
  if (user) {
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (now - lastActive > IDLE_TIMEOUT_MS) {
        // Sign out due to inactivity
        await supabase.auth.signOut();
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/login';
        redirectUrl.searchParams.set('reason', 'timeout');
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.delete('last_active');
        return response;
      }
    }
    
    // Update last_active
    supabaseResponse.cookies.set('last_active', now.toString(), {
      path: '/',
      maxAge: 60 * 60, // 60 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  // Route classification
  const pathname = request.nextUrl.pathname;
  const isAuthCallback = pathname.startsWith('/auth');
  const isLoginPage = pathname.startsWith('/login');
  const isRegisterPage = pathname.startsWith('/register');
  const isAcceptInvite = pathname.startsWith('/accept-invite');

  // Allow all /auth routes unconditionally (callback code exchange, signout, OTP verification)
  if (isAuthCallback) {
    return supabaseResponse;
  }

  // Unauthenticated users can access /login, /register, and /accept-invite
  if (!user) {
    if (isLoginPage || isRegisterPage || isAcceptInvite) {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated users visiting /login or /register should be sent to their dashboard
  if (isLoginPage || isRegisterPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated users on /accept-invite can stay to set their password
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
