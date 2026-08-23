"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function SignInPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <main className="page" style={{ maxWidth: 420, margin: "80px auto" }}>
        <div className="summary">Loading…</div>
      </main>
    );
  }

  // Signed in with Google, but not found (or inactive) in the users tab.
  if (session && !session.user.role) {
    return (
      <main className="page" style={{ maxWidth: 420, margin: "80px auto" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="page-title" style={{ marginBottom: 8 }}>Not set up yet</p>
          <p className="summary" style={{ marginBottom: 16 }}>
            You're signed in as <strong>{session.user.email}</strong>, but this email
            isn't listed as an active user in the users tab. Ask an admin to add you
            there with this exact email address.
          </p>
          <button className="submit-btn" onClick={() => signOut({ callbackUrl: "/signin" })}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 420, margin: "80px auto" }}>
      <div className="card" style={{ textAlign: "center" }}>
        <p className="brand" style={{ justifyContent: "center", marginBottom: 4 }}>
          <span style={{ color: "var(--navy)", fontWeight: 700, fontSize: 20 }}>MSMAS</span>
        </p>
        <p className="summary" style={{ marginBottom: 20 }}>Sign in with your team Google account to continue.</p>
        <button className="submit-btn" onClick={() => signIn("google", { callbackUrl: "/" })}>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
