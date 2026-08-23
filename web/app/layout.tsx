import type { Metadata } from "next";
import { Anton, Karla } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Karré",
  description: "Jeu de stratégie multijoueur sur grille en forme d'arène",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${anton.variable} ${karla.variable}`}>
      <body className="bg-ground text-ink antialiased transition-colors">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
