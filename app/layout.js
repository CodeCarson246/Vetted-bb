import "./globals.css";
import AppChrome from '@/components/AppChrome'
import InstallPrompt from '@/components/InstallPrompt'
import { AuthProvider } from '@/lib/auth-context'

export const metadata = {
  title: {
    default: "Vetted.bb | Find Trusted Freelancers in Barbados",
    template: "%s | Vetted.bb",
  },
  description: "Find trusted, reviewed freelancers across Barbados. Plumbers, electricians, designers, caterers and more, all rated by real clients.",
  keywords: ["freelancers Barbados", "tradespeople Barbados", "plumber Barbados", "electrician Barbados", "hire freelancer Barbados"],
  openGraph: {
    title: "Vetted.bb | Find Trusted Freelancers in Barbados",
    description: "Find trusted, reviewed freelancers across Barbados. Real reviews. Real accountability.",
    url: "https://vetted-bb.vercel.app",
    siteName: "Vetted.bb",
    locale: "en_BB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vetted.bb | Find Trusted Freelancers in Barbados",
    description: "Find trusted, reviewed freelancers across Barbados.",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: "Vetted.bb",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#00267F",
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the theme script intentionally sets
    // data-theme on <html> before hydration, so the attribute differs
    // from the server render — that one mismatch is expected.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint (prevents a light flash).
            The choice is stored in BOTH a cookie and localStorage: some
            platforms (private mode, in-app browsers, "clear on close")
            drop one but keep the other, so we read whichever survived and
            heal the other. Only an explicit choice is persisted; a first-time
            visitor still follows their OS preference until they use the toggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=document.cookie.match(/(?:^|; )vetted_theme=(dark|light)/);var t=(c&&c[1])||localStorage.getItem('vetted_theme');if(t==='dark'||t==='light'){try{localStorage.setItem('vetted_theme',t)}catch(e){}document.cookie='vetted_theme='+t+';path=/;max-age=31536000;samesite=lax'}else{t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
