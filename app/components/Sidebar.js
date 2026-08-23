"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/", label: "New Entry", icon: "add", roles: ["admin", "entry"] },
  { href: "/entries", label: "Approvals", icon: "list", roles: ["admin", "entry", "viewer"] },
  { href: "/statement", label: "Account Statement", icon: "search", roles: ["admin", "viewer"] },
  { href: "/financials", label: "Financial Statements", icon: "doc", roles: ["admin", "viewer"] },
  { href: "/dashboard", label: "Dashboard", icon: "chart", roles: ["admin", "viewer"] },
];

function Icon({ name }) {
  const paths = {
    add: <path d="M12 5v14M5 12h14" />,
    list: <path d="M4 6h16M4 12h16M4 18h10" />,
    chart: <path d="M4 20V10M12 20V4M20 20v-7" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></>,
    doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></>,
    external: <><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {paths[name]}
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const visibleItems = NAV_ITEMS.filter((item) => !role || item.roles.includes(role));

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">MSMAS</div>
      <ul className="sidebar-nav">
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link href={item.href} className={active ? "active" : ""}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="sidebar-footer">
        {session?.user && (
          <div className="sidebar-user">
            <div className="sidebar-user-name">{session.user.name}</div>
            <div className="sidebar-user-row">
              <span className="role-badge">{role}</span>
              <button className="sidebar-signout" onClick={() => signOut({ callbackUrl: "/signin" })}>
                Sign out
              </button>
            </div>
          </div>
        )}
        <a
          href="https://www.linkedin.com/in/lutforr/"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-footer-link"
        >
          <Icon name="external" />
          <span>Connect on LinkedIn</span>
        </a>
      </div>
    </nav>
  );
}
