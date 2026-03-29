'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Privacy() {
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setUser(u)
      if (u && u.user_metadata?.role !== 'client') {
        const { data: fp } = await supabase.from('freelancers').select('id, name, avatar_url').eq('user_id', u.id).single()
        setFreelancerProfile(fp || null)
        if (fp) {
          const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', fp.id).eq('read', false)
          setUnreadCount(count || 0)
        }
      }
    })
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-6">
            <a href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>Vetted.bb</a>
            <a href="/search" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <span className="hidden sm:inline">Browse Professionals</span>
              <span className="sm:hidden">Browse</span>
            </a>
          </div>
          <div className="hidden sm:flex gap-4 items-center">
            {user ? (
              <>
                {freelancerProfile ? (
                  <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {freelancerProfile.avatar_url
                        ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                        : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-gray-600 text-sm font-medium">{freelancerProfile.name}</span>
                  </a>
                ) : (
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium hover:text-gray-900">{user?.user_metadata?.full_name || user.email}</a>
                )}
                {freelancerProfile && (
                  <a href="/inbox" className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </a>
                )}
                <button
                  onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                  className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 hover:text-gray-900 font-medium">Log in</a>
                <a href="/signup" className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Sign up</a>
              </>
            )}
          </div>
          <button className="sm:hidden p-2 text-gray-600" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 px-8 py-4 flex flex-col gap-4">
            {user ? (
              <>
                {freelancerProfile ? (
                  <a href="/dashboard" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {freelancerProfile.avatar_url
                        ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                        : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-gray-600 text-sm font-medium">{freelancerProfile.name}</span>
                  </a>
                ) : (
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium">{user?.user_metadata?.full_name || user.email}</a>
                )}
                {freelancerProfile && (
                  <a href="/inbox" className="flex items-center gap-2 text-gray-700 font-medium">
                    Inbox
                    {unreadCount > 0 && (
                      <span className="min-w-[18px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </a>
                )}
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-left text-red-500 font-medium">Log out</button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-700 font-medium">Log in</a>
                <a href="/signup" className="font-medium" style={{ color: '#00267F' }}>Sign up</a>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14">

        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#00267F' }}>Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last updated: March 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-10 flex flex-col gap-10 text-gray-600 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>1. Overview</h2>
            <p>Vetted.bb ("we", "us", "our") is committed to protecting the privacy of everyone who uses our Platform. This Privacy Policy explains what personal information we collect, why we collect it, how we use and store it, and what rights you have over your data.</p>
            <p className="mt-3">By using Vetted.bb you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>2. Information We Collect</h2>
            <p>We collect only the information necessary to operate and improve the Platform. This includes:</p>

            <h3 className="font-semibold text-gray-800 mt-5 mb-2">Account information</h3>
            <ul className="list-disc list-inside flex flex-col gap-1.5 text-gray-500">
              <li>Your name and email address, provided at registration</li>
              <li>Your account role (client or freelancer)</li>
              <li>Your password, stored in hashed form (we never store plain-text passwords)</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-5 mb-2">Freelancer profile information</h3>
            <ul className="list-disc list-inside flex flex-col gap-1.5 text-gray-500">
              <li>Full name, trade or profession, location, and biography</li>
              <li>Hourly rate (used internally to calculate a price range indicator; the exact rate is never shown publicly)</li>
              <li>Skills and availability status</li>
              <li>Company name (optional)</li>
              <li>Profile photo, uploaded voluntarily</li>
              <li>Services you choose to list on your profile</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-5 mb-2">Messages</h3>
            <ul className="list-disc list-inside flex flex-col gap-1.5 text-gray-500">
              <li>Messages sent through the Platform's contact form, including sender name, email address, subject, and message body</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-5 mb-2">Reviews</h3>
            <ul className="list-disc list-inside flex flex-col gap-1.5 text-gray-500">
              <li>Reviews you write about freelancers or clients, including ratings, written comments, and the reviewer's display name</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-5 mb-2">Usage information</h3>
            <ul className="list-disc list-inside flex flex-col gap-1.5 text-gray-500">
              <li>Standard server logs may capture IP addresses and browser information for security and diagnostic purposes. We do not use this data for advertising or tracking.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc list-inside mt-3 flex flex-col gap-2 text-gray-500">
              <li><span className="text-gray-600 font-medium">To operate the Platform:</span> displaying freelancer profiles, facilitating contact between clients and freelancers, and showing reviews.</li>
              <li><span className="text-gray-600 font-medium">To manage your account:</span> authenticating you when you log in, sending password reset and email confirmation links.</li>
              <li><span className="text-gray-600 font-medium">To enable communication:</span> routing contact form messages to the intended freelancer's inbox on the Platform.</li>
              <li><span className="text-gray-600 font-medium">To improve the Platform:</span> understanding how users interact with the site so we can fix issues and add useful features.</li>
              <li><span className="text-gray-600 font-medium">To ensure safety and compliance:</span> detecting and preventing fraud, abuse, or violations of our Terms of Service.</li>
            </ul>
            <p className="mt-3">We do not sell your personal information. We do not use your data for targeted advertising.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>4. Who We Share Your Information With</h2>
            <p>We share your information only with the third-party service providers necessary to run the Platform. These are:</p>

            <div className="mt-4 flex flex-col gap-4">
              <div className="border border-gray-100 rounded-xl p-5">
                <p className="font-semibold text-gray-800">Supabase</p>
                <p className="text-sm mt-1 text-gray-500">We use Supabase as our database, authentication provider, and file storage platform. All user account data, profile information, messages, and reviews are stored in Supabase. Supabase is SOC 2 compliant and stores data in secure, encrypted infrastructure. For more information, see <span className="font-medium" style={{ color: '#00267F' }}>supabase.com/privacy</span>.</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-5">
                <p className="font-semibold text-gray-800">Resend</p>
                <p className="text-sm mt-1 text-gray-500">We use Resend to send transactional emails, such as password reset links and email confirmation messages. Resend receives your email address for the purpose of delivering these messages only. For more information, see <span className="font-medium" style={{ color: '#00267F' }}>resend.com/privacy</span>.</p>
              </div>
            </div>

            <p className="mt-4">We do not share your information with any other third parties, advertisers, or data brokers. We may disclose your information if required to do so by law or in response to a valid legal request from authorities in Barbados.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>5. Data Retention</h2>
            <p>We retain your personal information for as long as your account is active or as needed to provide you with the Platform's services.</p>
            <p className="mt-3">If you delete your account, we will delete your personal profile data within a reasonable period. Some information may be retained for longer where required by law, for fraud prevention, or to resolve disputes. Reviews you have written may remain visible on the Platform in anonymised form after account deletion.</p>
            <p className="mt-3">Messages sent through the Platform are retained to allow freelancers to access their inbox history. You may contact us to request deletion of specific messages.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>6. Your Rights</h2>
            <p>You have the following rights regarding your personal information:</p>
            <ul className="list-disc list-inside mt-3 flex flex-col gap-2 text-gray-500">
              <li><span className="text-gray-600 font-medium">Access:</span> You may request a copy of the personal data we hold about you.</li>
              <li><span className="text-gray-600 font-medium">Correction:</span> You may update your profile information at any time through your account dashboard. For other corrections, contact us directly.</li>
              <li><span className="text-gray-600 font-medium">Deletion:</span> You may request deletion of your account and associated personal data. We will action this within a reasonable timeframe, subject to any legal obligations to retain certain records.</li>
              <li><span className="text-gray-600 font-medium">Portability:</span> You may request an export of your personal data in a common machine-readable format.</li>
              <li><span className="text-gray-600 font-medium">Objection:</span> You may object to certain uses of your data. Where we rely on legitimate interest as a legal basis, you have the right to object and we will consider your request.</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at <span className="font-medium" style={{ color: '#00267F' }}>privacy@vetted.bb</span>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>7. Cookies</h2>
            <p>Vetted.bb uses session cookies to keep you logged in while you use the Platform. These are strictly necessary for the service to function and are not used for tracking or advertising purposes.</p>
            <p className="mt-3">We do not use third-party analytics cookies, advertising cookies, or any other non-essential cookies. You can disable cookies in your browser settings, but doing so will prevent you from staying logged in.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>8. Data Security</h2>
            <p>We take reasonable technical and organisational measures to protect your personal information from unauthorised access, disclosure, or destruction. These include encrypted connections (HTTPS), hashed password storage, and access controls on our database infrastructure provided by Supabase.</p>
            <p className="mt-3">No method of transmission over the internet or electronic storage is completely secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>9. Children's Privacy</h2>
            <p>Vetted.bb is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected information from a minor, please contact us and we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>10. Governing Law</h2>
            <p>This Privacy Policy is governed by the laws of Barbados. Any disputes relating to your privacy rights under this policy shall be subject to the jurisdiction of the courts of Barbados.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. When we do, we will revise the "last updated" date at the top of this page. We encourage you to review this page periodically. Continued use of the Platform after changes are posted constitutes your acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>12. Contact Us</h2>
            <p>For any questions, concerns, or requests relating to this Privacy Policy or your personal data, please contact us at:</p>
            <div className="mt-3 bg-gray-50 rounded-xl p-5 text-sm">
              <p className="font-semibold text-gray-800">Vetted.bb — Privacy</p>
              <p className="mt-1 text-gray-500">Email: <span className="font-medium" style={{ color: '#00267F' }}>privacy@vetted.bb</span></p>
              <p className="text-gray-500">Barbados</p>
            </div>
          </section>

        </div>
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-8">
        <p>© 2026 Vetted.bb · Connecting Barbados</p>
        <p className="mt-1.5 text-xs">
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <span className="mx-2">·</span>
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </p>
      </footer>
    </main>
  )
}
