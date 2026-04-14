export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md">
          <p className="text-8xl font-bold" style={{ color: '#00267F' }}>404</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Oops, this page doesn't exist</h1>
          <p className="text-gray-500 mt-3">The page you're looking for may have been moved or doesn't exist.</p>
          <div className="flex gap-3 justify-center mt-8">
            <a
              href="/"
              className="px-6 py-2.5 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F' }}
            >
              Go home
            </a>
            <a
              href="/search"
              className="px-6 py-2.5 rounded-full font-medium border-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#00267F', color: '#00267F' }}
            >
              Find a freelancer
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
