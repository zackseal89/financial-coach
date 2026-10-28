import "./globals.css";
export const metadata = {
  title: "Steady — Your Kenyan money coach",
  description:
    "A Kenyan personal finance workspace in KES, with coaching from a Google ADK multi-agent system.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE">
      <body>{children}</body>
    </html>
  );
}

