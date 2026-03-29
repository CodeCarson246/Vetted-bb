import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Vetted.bb — Find Trusted Freelancers in Barbados",
    template: "%s | Vetted.bb",
  },
  description: "Find trusted, reviewed freelancers across Barbados. Plumbers, electricians, designers, caterers and more, all rated by real clients.",
  keywords: ["freelancers Barbados", "tradespeople Barbados", "plumber Barbados", "electrician Barbados", "hire freelancer Barbados"],
  openGraph: {
    title: "Vetted.bb — Find Trusted Freelancers in Barbados",
    description: "Find trusted, reviewed freelancers across Barbados. Real reviews. Real accountability.",
    url: "https://vetted-bb.vercel.app",
    siteName: "Vetted.bb",
    locale: "en_BB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vetted.bb — Find Trusted Freelancers in Barbados",
    description: "Find trusted, reviewed freelancers across Barbados.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
