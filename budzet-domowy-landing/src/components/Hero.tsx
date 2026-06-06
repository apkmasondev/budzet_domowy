import { motion } from 'framer-motion';
import { Download, Monitor, CheckCircle, Apple, MonitorDot } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Twój Budżet. <br className="hidden md:block" />
            <span className="text-gradient">W 100% Prywatnie.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-xl text-text-muted mx-auto mb-10">
            Nowoczesna i ultraszybka aplikacja desktopowa do zarządzania finansami. Żadnej chmury, żadnych subskrypcji. Twoje dane zostają u Ciebie.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-16">
            <button className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-full font-semibold transition-all shadow-lg shadow-primary/25 hover:scale-105 active:scale-95">
              <Download size={20} />
              Pobierz za darmo
            </button>
            <div className="flex items-center gap-4 text-text-muted text-sm mt-4 sm:mt-0">
              <span className="flex items-center gap-1"><Monitor size={16} /> Windows</span>
              <span className="flex items-center gap-1"><Apple size={16} /> macOS</span>
              <span className="flex items-center gap-1"><MonitorDot size={16} /> Linux</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative mx-auto max-w-5xl"
        >
          {/* Placeholder for the main screenshot */}
          <div className="glass-card rounded-2xl p-2 md:p-4 shadow-2xl relative group">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 rounded-2xl pointer-events-none" />
            <div className="aspect-[16/10] bg-surface-hover rounded-xl overflow-hidden relative flex items-center justify-center border border-white/5">
              <div className="text-center p-8">
                <Monitor size={64} className="mx-auto text-primary/50 mb-4" />
                <h3 className="text-xl font-medium text-white/70 mb-2">Miejsce na Twój Zrzut Ekranu</h3>
                <p className="text-sm text-text-muted max-w-md">Zrób niesamowitego screena ze swojej aplikacji Domowy Budżet i umieść go tutaj, podmieniając obrazek w kodzie.</p>
              </div>
              {/* <img src="/screenshots/app-main.png" alt="Domowy Budżet App" className="w-full h-full object-cover" /> */}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
