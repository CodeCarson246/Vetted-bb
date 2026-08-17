export const metadata = {
  title: 'Terms of Service',
  description: 'The terms governing use of Vetted.bb, the marketplace for trusted professionals in Barbados.',
  alternates: { canonical: 'https://vetted.bb/terms' },
}

export default function Terms() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14">

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#00267F' }}>Terms of Service</h1>
          <p className="text-sm text-gray-400">Last updated: August 2026</p>
        </div>

        {/* Plain-language summary of the liability position */}
        <div className="mb-8 rounded-2xl px-5 py-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#92400E' }}>In plain terms</p>
          <p className="text-sm" style={{ color: '#92400E', lineHeight: 1.65 }}>
            Vetted.bb is only a middleman that helps clients and freelancers find each other. We do not provide the services, handle any payments, or take part in your agreements. Any transaction, booking, or goods or services are entirely between you and the other user, and you use the Platform at your own risk. This summary is not a substitute for the full terms below (see sections 2, 8, 13, 14 and 15).
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-10 flex flex-col gap-10 text-gray-600 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>1. Acceptance of Terms</h2>
            <p>By accessing or using Vetted.bb (the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Platform. These Terms apply to all visitors, registered users, clients, and freelancers who access or use our services.</p>
            <p className="mt-3">We may update these Terms from time to time. Continued use of the Platform after any changes constitutes your acceptance of the revised Terms. We will indicate the date of the most recent revision at the top of this page.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>2. Description of Service</h2>
            <p>Vetted.bb is an online marketplace that connects clients with independent freelancers based in Barbados. We provide tools for discovery, communication, quotes, bookings, and reviews. We act only as a neutral venue (a middleman) that helps users find and contact one another. We are not a staffing agency, employer, broker, agent, or service provider, and we are not a party to any transaction between users.</p>
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
              <li><span className="text-gray-600 font-medium">Accurate profiles:</span> All information on your profile (including your name, trade, skills, location, and availability) must be truthful and kept up to date. Misleading or false information is grounds for account removal.</li>
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
            <p>All content on the Vetted.bb Platform (including the name, logo, design, text, and software) is the property of Vetted.bb or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any part of the Platform without our express written consent.</p>
            <p className="mt-3">By submitting content to the Platform (including profile information, photos, and reviews), you grant Vetted.bb a non-exclusive, royalty-free, worldwide licence to use, display, and distribute that content in connection with operating and promoting the Platform.</p>
            <p className="mt-3">You represent that you own or have the necessary rights to any content you submit and that it does not infringe the rights of any third party.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>8. Limitation of Liability</h2>
            <p>To the fullest extent permitted by applicable law, Vetted.bb and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the Platform, including but not limited to:</p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-gray-500">
              <li>The quality, safety, or outcome of any work performed by a freelancer</li>
              <li>The delivery, non-delivery, or standard of any goods or services</li>
              <li>Any payment, non-payment, or refund between users</li>
              <li>Any booking that is missed, cancelled, or not honoured by either party</li>
              <li>Any fraud, theft, personal injury, or property damage arising from a connection made through the Platform</li>
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
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>12. Reviews &amp; Ratings Policy</h2>
            <p>By submitting a review on Vetted.bb, you confirm that:</p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-gray-500">
              <li>The review is based on a genuine experience with the service provider</li>
              <li>The content is truthful, fair, and not misleading</li>
              <li>The review does not contain defamatory, abusive, discriminatory, or unlawful content</li>
            </ul>
            <p className="mt-3">Vetted.bb reserves the right to remove any review that, in our sole discretion, violates these standards or is reasonably believed to be false, fraudulent, or submitted in bad faith.</p>
            <p className="mt-3">Reviews represent the opinions of individual users and do not represent the views of Vetted.bb. Vetted.bb is not liable for the content of user-submitted reviews.</p>
            <p className="mt-3">Freelancers may dispute a review by contacting <span className="font-medium" style={{ color: '#00267F' }}>support@vetted.bb</span>. Disputes are reviewed within 7 business days. Vetted.bb&apos;s decision on review disputes is final.</p>
            <p className="mt-3">Verified badges confirm identity only, not the quality or outcome of any service delivered. Vetted.bb makes no guarantee of service quality for any listed professional.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>13. Platform Role</h2>
            <p>Vetted.bb is a marketplace platform only. We are not a party to any contract, agreement, or transaction between clients and service providers. We do not handle payments, guarantee work quality, or mediate financial disputes. Any agreement made through this platform is solely between the client and the freelancer.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>14. Transactions, Payments and Goods</h2>
            <p>Vetted.bb is a neutral venue that helps clients and freelancers find and contact one another. We act only as a middleman. We are not a party to, and accept no responsibility or liability for, any transaction, agreement, booking, service, or sale arranged between users.</p>
            <p className="mt-3">To the fullest extent permitted by applicable law, Vetted.bb gives no warranty and accepts no responsibility for:</p>
            <ul className="list-disc list-inside mt-2 flex flex-col gap-1.5 text-gray-500">
              <li>the quality, safety, legality, fitness, or timeliness of any goods or services provided by a freelancer;</li>
              <li>whether any user actually performs, attends, delivers, or pays as agreed;</li>
              <li>the accuracy of any listing, price, quote, invoice, review, or profile information;</li>
              <li>any payment between users. Vetted.bb does not process, hold, collect, or handle money. All payments are arranged and made directly between the client and the freelancer, off the Platform, using methods they choose;</li>
              <li>any loss, damage, injury, theft, fraud, or dispute arising from a connection made through the Platform.</li>
            </ul>
            <p className="mt-3">Quotes, invoices, and booking requests created through Vetted.bb are communication tools only. They are not offered, sold, guaranteed, or enforced by Vetted.bb and do not make us a party to any resulting agreement. Any contract for goods or services is solely between the client and the freelancer, and any dispute must be resolved directly between them. You use the Platform, and transact with other users, entirely at your own risk.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>15. Assumption of Risk and Indemnification</h2>
            <p>You use Vetted.bb, and engage with other users, at your own risk. You are responsible for exercising your own judgement, taking your own precautions, and verifying the identity, credentials, insurance, and reliability of anyone you deal with before entering into any agreement or making any payment.</p>
            <p className="mt-3">You agree to indemnify, defend, and hold harmless Vetted.bb and its operators from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or connected with: (a) your use of the Platform; (b) any transaction, agreement, booking, or dispute between you and another user; (c) any goods or services you provide or receive; or (d) your breach of these Terms or of any applicable law.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#00267F' }}>16. Contact</h2>
            <p>If you have questions about these Terms of Service, please contact us at <span className="font-medium" style={{ color: '#00267F' }}>hello@vetted.bb</span>.</p>
          </section>

        </div>
      </div>

    </main>
  )
}
