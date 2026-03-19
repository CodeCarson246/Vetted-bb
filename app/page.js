'use client'
const categories = [
  { icon: "🔧", name: "Plumbing" },
  { icon: "⚡", name: "Electrical" },
  { icon: "🎨", name: "Graphic Design" },
  { icon: "🏗️", name: "Construction" },
  { icon: "💻", name: "Web Development" },
  { icon: "🌿", name: "Landscaping" },
  { icon: "🚗", name: "Auto Repair" },
  { icon: "📸", name: "Photography" },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <span className="text-2xl font-bold text-blue-600">Vetted.bb</span>
        <div className="flex gap-4">
          <a href="/login" className="text-gray-600 hover:text-gray-900 font-medium">Log in</a>
          <a href="/signup" className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700">Sign up</a>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto text-center px-8 py-24">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">Find trusted freelancers in Barbados</h1>
        <p className="text-xl text-gray-500 mb-10">Every freelancer is reviewed by real clients. Every client is reviewed by freelancers. Real accountability, both ways.</p>
        <div className="flex gap-3 max-w-2xl mx-auto">
  <input
    type="text"
    id="homeSearch"
    placeholder="What do you need? e.g. plumber, graphic designer..."
    className="flex-1 px-5 py-4 border border-gray-200 rounded-full text-gray-900 outline-none focus:border-blue-400"
  />
  <button
    className="bg-blue-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-blue-700"
    onClick={() => {
      const q = document.getElementById('homeSearch').value
      window.location.href = `/search?q=${q}`
    }}
  >Search</button>
</div>
      </section>

      <section className="max-w-5xl mx-auto px-8 pb-24">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Browse by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.name} className="flex flex-col items-center gap-3 p-6 border border-gray-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50 cursor-pointer transition-all">
              <span className="text-4xl">{cat.icon}</span>
              <span className="font-medium text-gray-700">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}