import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnalyticsTracker from "@/components/AnalyticsTracker";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Keepin' It Real - San Diego",
  description: "Join Chris and Gary, a travelling father and son bicycle team, as they pedal around San Diego to interview folks who share their wisdom, humor, and incredible stories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning={true}>
      <body suppressHydrationWarning={true}>
        <AnalyticsTracker />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
