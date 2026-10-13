import type { Metadata } from "next";
import "@fontsource/anton/400.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harlem Night Market",
  description: "Vendor registration for the Harlem Night Market.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
