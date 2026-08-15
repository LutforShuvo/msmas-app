"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "New Entry", icon: "add" },
  { href: "/entries", label: "Recent Entries", icon: "list" },
  { href: "/statement", label: "Account Statement", icon: "search" },
  { href: "/dashboard", label: "Dashboard", icon: "chart" },
];

function Icon({ name }) {
  const paths = {
    add: <path d="M12 5v14M5 12h14" />,
    list: <path d="M4 6h16M4 12h16M4 18h10" />,
    chart: <path d="M4 20V10M12 20V4M20 20v-7" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {paths[name]}
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">MSMAS</div>
      <ul className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
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
    </nav>
  );
}
