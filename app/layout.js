import "./globals.css";

export const metadata = {
  title: "MSMAS — Entry",
  description: "Multi-store micro-accounting entry form",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
