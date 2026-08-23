export { default } from "next-auth/middleware";

// Runs on every request except the sign-in page itself and the auth API
// routes (which handle the sign-in flow and must stay reachable). Anyone
// without a valid session gets redirected to /signin automatically.
export const config = {
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)"],
};
