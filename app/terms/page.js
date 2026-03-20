'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Terms() {
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
          <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
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
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#00267F' }}>Terms of Service</h1>
          <p className="text-sm text-gray-400">Last updated: March 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-10 flex flex-col gap-10 text-gray-600 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>1. Acceptance of Terms</h2>
            <p>By accessing or using Vetted.bb (the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Platform. These Terms apply to all visitors, registered users, clients, and freelancers who access or use our services.</p>
            <p className="mt-3">We may update these Terms from time to time. Continued use of the Platform after any changes constitutes your acceptance of the revised Terms. We will indicate the date of the most recent revision at the top of this page.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>2. Description of Service</h2>
            <p>Vetted.bb is an online marketplace that connects clients with independent freelancers based in Barbados. We provide a platform for discovery, communication, and review — we are not a staffing agency, employer, or service provider.</p>
            <p className="mt-3">Vetted.bb does not employ freelancers, does not guarantee the quality or completion of any work, and is not a party to any agreement made between a client and a freelancer. Any contract for services is solely between the client and the freelancer. Vetted.bb accepts no liability for disputes, losses, or damages arising from those arrangements.</p>
            <p className="mt-3">We reserve the right to modify, suspend, or discontinue any aspect of the Platform at any time without prior notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>3. User Accounts and Responsibilities</h2>
            <p>To access certain features of the Platform you must create an account. You agree to provide accurate, current, and complete information during registration and to keep your account information up to date.</p>
            <p className="mt-3">You are solely responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify us immediately if you suspect any unauthorised use of your account.</p>
            <p className="mt-3">You must be at least 18 years of age to create an account. By registering, you represent and warrant that you meet this requirement.</p>
            <p className="mt-3">You agree not to:</p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-gray-500">
              <li>Create accounts for fraudulent, misleading, or unlawful purposes</li>
              <li>Share, sell, or transfer your account to any other person</li>
              <li>Impersonate any person or entity or misrepresent your identity</li>
              <li>Use automated tools, bots, or scripts to access or interact with the Platform</li>
              <li>Attempt to gain unauthorised access to any part of the Platform or its infrastructure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>4. Freelancer Obligations</h2>
            <p>By registering as a freelancer on Vetted.bb, you agree to the following:</p>
            <ul className="list-disc list-inside mt-3 flex flex-col gap-2 text-gray-500">
              <li><span className="text-gray-600 font-medium">Accurate profiles:</span> All information on your profile — including your name, trade, skills, location, and availability — must be truthful and kept up to date. Misleading or false information is grounds for account removal.</li>
              <li><span className="text-gray-600 font-medium">Honest reviews:</span> Reviews you leave about clients must reflect genuine experiences. You must not submit reviews in exchange for payment, discounts, or any other incentive.</li>
              <li><span className="text-gray-600 font-medium">Professional conduct:</span> You agree to treat all clients with professionalism and respect, both on the Platform and in any work arising from connections made through it.</li>
              <li><span className="text-gray-600 font-medium">Legal compliance:</span> You are responsible for ensuring that you have any licences, certifications, insurance, or permits required to perform the services you advertise. Vetted.bb does not verify these credentials.</li>
              <li><span className="text-gray-600 font-medium">Tax obligations:</span> You are solely responsible for declaring and paying any income tax, VAT, or other levies applicable to income earned through work arranged via the Platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>5. Client Obligations</h2>
            <p>By using Vetted.bb as a client, you agree to:</p>
            <ul className="list-disc list-inside mt-3 flex flex-col gap-2 text-gray-500">
              <li><span className="text-gray-600 font-medium">Honest reviews:</span> Reviews you leave about freelancers must be based on genuine experiences. Fake, retaliatory, or incentivised reviews are prohibited.</li>
              <li><span className="text-gray-600 font-medium">Fair treatment:</span> You agree to treat all freelancers with courtesy and respect. Harassment, discrimination, or abusive communication is prohibited and may result in account termination.</li>
              <li><span className="text-gray-600 font-medium">Accurate information:</span> Any information you provide when contacting a freelancer or leaving a review must be truthful.</li>
              <li><span className="text-gray-600 font-medium">Direct agreements:</span> Any agreement you reach with a freelancer regarding scope, payment, and timeline is between you and that freelancer. Vetted.bb is not a party to that agreement and accepts no responsibility for its fulfilment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>6. Two-Way Review System and Acceptable Use</h2>
            <p>Vetted.bb operates a mutual review system: clients may review freelancers, and freelancers may review clients. This system exists to build trust and accountability across the community.</p>
            <p className="mt-3">The following are strictly prohibited in relation to reviews and general use of the Platform:</p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-gray-500">
              <li>Submitting false, fabricated, or misleading reviews</li>
              <li>Paying for, soliciting, or offering any incentive in exchange for reviews</li>
              <li>Submitting reviews about people you have not genuinely worked with</li>
              <li>Using reviews as a tool for harassment, extortion, or retaliation</li>
              <li>Posting content that is defamatory, obscene, hateful, or unlawful</li>
              <li>Attempting to manipulate ratings or rankings on the Platform</li>
              <li>Contacting other users for purposes unrelated to the services offered</li>
            </ul>
            <p className="mt-3">We reserve the right to remove any review or content that we believe violates these Terms, at our sole discretion.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>7. Intellectual Property</h2>
            <p>All content on the Vetted.bb Platform — including the name, logo, design, text, and software — is the property of Vetted.bb or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any part of the Platform without our express written consent.</p>
            <p className="mt-3">By submitting content to the Platform (including profile information, photos, and reviews), you grant Vetted.bb a non-exclusive, royalty-free, worldwide licence to use, display, and distribute that content in connection with operating and promoting the Platform.</p>
            <p className="mt-3">You represent that you own or have the necessary rights to any content you submit and that it does not infringe the rights of any third party.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>8. Limitation of Liability</h2>
            <p>To the fullest extent permitted by applicable law, Vetted.bb and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the Platform, including but not limited to:</p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-gray-500">
              <li>The quality, safety, or outcome of any work performed by a freelancer</li>
              <li>Disputes between clients and freelancers</li>
              <li>Loss of income, data, or business opportunity</li>
              <li>Unauthorised access to your account</li>
              <li>Any reliance placed on information published on a freelancer's profile</li>
            </ul>
            <p className="mt-3">The Platform is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>9. Dispute Resolution</h2>
            <p>Vetted.bb is a marketplace and does not mediate, arbitrate, or adjudicate disputes between clients and freelancers. We encourage all users to resolve disagreements directly and professionally.</p>
            <p className="mt-3">If you have a concern about another user's conduct on the Platform, you may contact us and we will review the matter at our discretion. We reserve the right to remove content, suspend, or terminate accounts where we determine there has been a breach of these Terms.</p>
            <p className="mt-3">Any legal dispute between a user and Vetted.bb shall first be subject to good-faith negotiation. If unresolved within 30 days, such disputes shall be submitted to the courts of Barbados.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>10. Termination</h2>
            <p>You may delete your account at any time by contacting us. Upon termination, your right to use the Platform ceases immediately. We may retain certain information as required by law or for legitimate business purposes.</p>
            <p className="mt-3">We reserve the right to suspend or permanently terminate your account without prior notice if we determine, at our sole discretion, that you have violated these Terms, engaged in fraudulent activity, or acted in a way that is harmful to other users or to the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>11. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of Barbados, without regard to its conflict of law provisions. By using the Platform, you consent to the exclusive jurisdiction of the courts of Barbados for any disputes arising under these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>12. Contact</h2>
            <p>If you have questions about these Terms of Service, please contact us at <span className="font-medium" style={{ color: '#00267F' }}>hello@vetted.bb</span>.</p>
          </section>

        </div>
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-8">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
