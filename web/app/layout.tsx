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

export const viewport = {
  themeColor: "#EDE4D3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Karre Game's",
  description: "Jeu de stratégie multijoueur sur grille en forme d'arène",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Karre Game's",
  },
  // Favicon transparent, K noir en clair / blanc en sombre — suit le thème du
  // système d'exploitation (prefers-color-scheme), pas le thème choisi dans
  // l'app : la barre d'onglets du navigateur n'a pas accès au JS de la page.
  icons: [
    { url: "/icon-light.png", media: "(prefers-color-scheme: light)" },
    { url: "/icon-dark.png", media: "(prefers-color-scheme: dark)" },
  ],
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
