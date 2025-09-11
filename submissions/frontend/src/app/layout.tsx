import { Montserrat } from "next/font/google";

import "./globals.scss";

const montserrat = Montserrat({ subsets: ["latin", "cyrillic"] });

export const metadata = {
  title: "Каталог",
  description: "Интерактивный магазин с фильтрами, корзиной и SSR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={montserrat.className}>
        {children}
      </body>
    </html>
  );
}