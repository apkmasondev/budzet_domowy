import Hero from './components/Hero';
import Features from './components/Features';
import CTA from './components/CTA';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-text-main selection:bg-primary/30 selection:text-white">
      {/* Navbar / Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white">
              <span className="font-serif">B</span>
            </div>
            Domowy Budżet
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
            <a href="#features" className="hover:text-white transition-colors">Funkcje</a>
            <a href="https://github.com/apkmasondev/budzet_domowy/issues" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Zgłoś Błąd</a>
          </nav>
          <a 
            href="https://github.com/apkmasondev/budzet_domowy/releases" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors border border-white/5"
          >
            Pobierz
          </a>
        </div>
      </header>

      <main className="flex-grow">
        <Hero />
        <div id="features">
          <Features />
        </div>
        <CTA />
      </main>

      <Footer />
    </div>
  );
}

export default App;
