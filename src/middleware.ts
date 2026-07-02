import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;
  const isLoggedIn = !!user;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
  const isAuthPage = nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(
      new URL(user.role === "ADMIN" ? "/admin" : "/dashboard", nextUrl),
    );
  }

  if ((isAdminRoute || isDashboardRoute) && !isLoggedIn) {
    const login = new URL("/login", nextUrl);
    login.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(login);
  }

  // Affiliates can never reach /admin; admins may browse /dashboard freely.
  if (isAdminRoute && user?.role !== "ADMIN") {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
