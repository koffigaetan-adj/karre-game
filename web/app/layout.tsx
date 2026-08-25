import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-poppins",
});

export const viewport = {
  themeColor: "#EDE4D3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Kwadra",
  description: "Jeu de stratégie multijoueur sur grille en forme d'arène",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kwadra",
  },
  // Favicon transparent, K noir en clair / blanc en sombre — suit le thème du
  // système d'exploitation (prefers-color-scheme), pas le thème choisi dans
  // l'app : la barre d'onglets du navigateur n'a pas accès au JS de la page.
  icons: [
    { url: "/icon-light.png", media: "(prefers-color-scheme: light)" },
    { url: "/icon-dark.png", media: "(prefers-color-scheme: dark)" },
  ],
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Kwadra",
    description: "Rejoins-moi pour une partie de Kwadra en temps réel !",
    url: "https://Kwadra-games.vercel.app",
    siteName: "Kwadra",
    images: [
      {
        url: "https://Kwadra-games.vercel.app/logo-light.png", // absolute URL is recommended for OG images
        width: 512,
        height: 512,
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
};

import { AnimatedBackground } from "@/components/AnimatedBackground";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${poppins.variable}`}>
      <body className="bg-ground text-ink antialiased transition-colors">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            <AnimatedBackground />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
