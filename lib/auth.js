import GoogleProvider from "next-auth/providers/google";
import { readRows } from "./sheets";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Runs whenever a session is checked. We look the signed-in email up in
    // the users tab every time — same "always live" principle as the rest
    // of the app — so a role change in the Sheet takes effect on that
    // person's next request, no redeploy needed.
    async session({ session }) {
      if (!session?.user?.email) return session;
      try {
        const users = await readRows("users!A2:F");
        const email = session.user.email.toLowerCase();
        const match = users.find((r) => (r[2] || "").toLowerCase() === email);
        if (match) {
          session.user.userId = match[0];
          session.user.name = match[1] || session.user.name;
          session.user.role = (match[4] || "").toLowerCase();
          session.user.status = (match[5] || "").toLowerCase();
        } else {
          session.user.role = null; // signed in with Google, but not a known team member
        }
      } catch (err) {
        console.error("Role lookup failed:", err);
        session.user.role = null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
