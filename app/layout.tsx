import "./globals.css";
export const metadata = {
  title: "Steady — Your financial coach",
  description:
    "Make room for what matters. A personal finance workspace powered by Google ADK.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
