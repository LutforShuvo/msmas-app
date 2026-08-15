import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata = {
  title: "MSMAS — Entry",
  description: "Multi-store micro-accounting entry form",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
