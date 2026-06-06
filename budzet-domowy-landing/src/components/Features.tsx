import { motion } from 'framer-motion';
import { ShieldCheck, PieChart, Import, WalletCards, BellRing, Target } from 'lucide-react';

const features = [
  {
    icon: <WalletCards className="w-6 h-6 text-primary" />,
    title: 'Zero-Based Budgeting',
    description: 'Każda złotówka ma swoje zadanie. System kopertowy nie pozwoli Ci wydać więcej, niż aktualnie posiadasz.'
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
    title: 'Offline-First & Prywatność',
    description: 'Cała baza danych (SQLite) znajduje się tylko na Twoim dysku. Zero telemetrii i zero wysyłania danych na serwery.'
  },
  {
    icon: <Import className="w-6 h-6 text-blue-400" />,
    title: 'Inteligentny Import CSV',
    description: 'Wrzuć plik z historią swojego banku, przypisz kolumny w locie i ciesz się magią automatycznej kategoryzacji.'
  },
  {
    icon: <PieChart className="w-6 h-6 text-purple-400" />,
    title: 'Zaawansowana Analityka',
    description: 'Wykresy i panele Pro, liczące bezbłędnie Twój Saving Rate oraz cash-flow, całkowicie pomijające sztuczne transfery.'
  },
  {
    icon: <Target className="w-6 h-6 text-orange-400" />,
    title: 'Cele Oszczędnościowe',
    description: 'Buduj dedykowane wirtualne skarbonki na wakacje, auto lub poduszkę finansową i śledź swój postęp krok po kroku.'
  },
  {
    icon: <BellRing className="w-6 h-6 text-pink-400" />,
    title: 'Płatności Cykliczne',
    description: 'Aplikacja sama wykryje powtarzalne subskrypcje i zasugeruje automatyczne księgowanie po zalogowaniu.'
  }
];

export default function Features() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Zaprojektowane by odzyskać kontrolę</h2>
          <p className="text-text-muted text-lg">
            Porzuć chaotyczne arkusze kalkulacyjne. Domowy Budżet łączy elegancję z potężnymi narzędziami, z których korzystają profesjonaliści.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card p-6 rounded-2xl hover:bg-surface-hover/50 transition-colors"
            >
              <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center mb-6 border border-white/5">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
