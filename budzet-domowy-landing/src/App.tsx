import { useState } from 'react';
import Hero from './components/Hero';
import Gallery from './components/Gallery';
import Features from './components/Features';
import CTA from './components/CTA';
import Footer from './components/Footer';
import { Menu, X } from 'lucide-react';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col font-sans text-text-main selection:bg-primary/30 selection:text-white">
      {/* Navbar / Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xl font-bold tracking-tight">
            <img src="/budzet_domowy/app-icon.svg" alt="Logo" className="w-8 h-8 drop-shadow-md" />
            Domowy Budżet
          </div>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
            <a href="#gallery" className="hover:text-white transition-colors">Galeria</a>
            <a href="#features" className="hover:text-white transition-colors">Funkcje</a>
            <a href="mailto:apkmasondev@gmail.com?subject=Zgłoszenie%20błędu%20-%20Domowy%20Budżet" className="hover:text-white transition-colors">Zgłoś Błąd</a>
            <a 
              href="https://github.com/apkmasondev/budzet_domowy/releases/latest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors border border-white/5"
            >
              Pobierz
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-text-muted hover:text-white transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl px-4 py-4 flex flex-col gap-4">
            <a href="#gallery" onClick={() => setIsMenuOpen(false)} className="text-text-muted hover:text-white font-medium">Galeria</a>
            <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-text-muted hover:text-white font-medium">Funkcje</a>
            <a href="mailto:apkmasondev@gmail.com?subject=Zgłoszenie%20błędu%20-%20Domowy%20Budżet" onClick={() => setIsMenuOpen(false)} className="text-text-muted hover:text-white font-medium">Zgłoś Błąd</a>
            <a 
              href="https://github.com/apkmasondev/budzet_domowy/releases/latest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-center font-medium transition-colors"
            >
              Pobierz Aplikację
            </a>
          </div>
        )}
      </header>

      <main className="flex-grow">
        <Hero />
        <Gallery />
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
