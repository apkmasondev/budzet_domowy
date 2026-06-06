import { Github, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-background/50 backdrop-blur-md pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        
        <div className="flex items-center gap-2 text-xl font-bold">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white">
            <span className="font-serif">B</span>
          </div>
          Domowy Budżet
        </div>

        <div className="text-text-muted text-sm text-center md:text-left flex items-center gap-1">
          Zaprojektowane z <Heart size={14} className="text-pink-500 fill-pink-500" /> przez apkmasondev. Licencja MIT.
        </div>

        <div className="flex items-center gap-4">
          <a 
            href="https://github.com/apkmasondev/budzet_domowy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-text-muted hover:text-white transition-colors"
          >
            <Github size={24} />
            <span className="sr-only">GitHub</span>
          </a>
        </div>
        
      </div>
    </footer>
  );
}
