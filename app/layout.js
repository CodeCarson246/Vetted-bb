import "./globals.css";
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import { AuthProvider } from '@/lib/auth-context'

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
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <SiteNav />
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
