import { Bug, ArrowRight, Terminal } from 'lucide-react';

export default function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 text-primary/10 rotate-12">
            <Bug size={200} />
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Gotowy odzyskać kontrolę?</h2>
          <p className="text-xl text-text-muted mb-10 max-w-2xl mx-auto">
            Dołącz do grona testerów wersji 2.0. Pobierz aplikację już teraz za darmo i zacznij zarządzać finansami na własnych zasadach. Znalazłeś błąd? Napisz do nas!
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <a 
              href="https://github.com/apkmasondev/budzet_domowy/releases" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-full font-semibold transition-all shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 w-full sm:w-auto justify-center"
            >
              Pobierz Aplikację <ArrowRight size={20} />
            </a>
            
            <a 
              href="mailto:apkmasondev@gmail.com?subject=Zgłoszenie%20błędu%20-%20Domowy%20Budżet" 
              className="flex items-center gap-2 bg-surface hover:bg-surface-hover border border-white/10 text-white px-8 py-4 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 w-full sm:w-auto justify-center"
            >
              <Terminal size={20} />
              Zgłoś Błąd
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
