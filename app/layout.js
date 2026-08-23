import "./globals.css";
import SessionProviderWrapper from "./components/SessionProviderWrapper";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "MSMAS — Entry",
  description: "Multi-store micro-accounting entry form",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <AppShell>{children}</AppShell>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
