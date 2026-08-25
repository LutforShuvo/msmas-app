import GoogleProvider from "next-auth/providers/google";
import { readRows } from "./sheets";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours — a role change in the users tab takes effect
    // the next time someone's token refreshes (at most a day), not instantly.
    // Trade-off made deliberately for speed: role checks used to hit the
    // Sheet on every single request, which was the main cause of slow
    // entry submission. Sign out and back in to pick up a role change
    // immediately, if you don't want to wait for the daily refresh.
  },
  callbacks: {
    // Runs once when someone signs in (and again only when the token is
    // due to refresh) — NOT on every request. This is where the one-time
    // users-tab lookup happens now.
    async jwt({ token, user }) {
      if (user) {
        try {
          const users = await readRows("users!A2:F");
          const email = (user.email || "").toLowerCase();
          const match = users.find((r) => (r[2] || "").toLowerCase() === email);
          if (match) {
            token.userId = match[0];
            token.name = match[1] || token.name;
            token.role = (match[4] || "").toLowerCase();
            token.status = (match[5] || "").toLowerCase();
          } else {
            token.role = null; // signed in with Google, but not a known team member
          }
        } catch (err) {
          console.error("Role lookup failed:", err);
          token.role = null;
        }
      }
      return token;
    },
    // Runs on every request, but now it's just copying fields already sitting
    // in the token — no Sheet call, no meaningful latency added.
    async session({ session, token }) {
      session.user.userId = token.userId;
      session.user.name = token.name || session.user.name;
      session.user.role = token.role;
      session.user.status = token.status;
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
