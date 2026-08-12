import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DefectScan — Quality Inspection Platform",
  description:
    "Enterprise-grade automated visual defect detection for industrial production lines, powered by ONNX autoencoder reconstruction analysis.",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * No className="dark" — dark mode is driven by the OS color-scheme
     * preference via the @custom-variant in globals.css.
     */
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}
