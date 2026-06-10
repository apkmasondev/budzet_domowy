import { useState, useEffect } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { Lock, Unlock, ShieldAlert } from "lucide-react";

export default function LockScreen() {
  const { unlock } = useFinanceStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const handleKeyPress = (num: number) => {
    if (isLockedOut) return;
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleBackspace = () => {
    if (isLockedOut) return;
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = async () => {
    if (isLockedOut) return;
    if (pin.length < 4) return;
    const success = await unlock(pin);
    if (!success) {
      setError(true);
      setPin("");
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockoutUntil(Date.now() + 30000); // 30 sekund blokady
        setAttempts(0);
      }
    } else {
      setAttempts(0);
    }
  };

  useEffect(() => {
    if (lockoutUntil) {
      const interval = setInterval(() => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutUntil(null);
          setTimeLeft(0);
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLockedOut) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(parseInt(e.key));
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isLockedOut, attempts]); // Fixed stale closure by adding proper dependencies

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="flex flex-col items-center max-w-sm w-full p-8 rounded-3xl bg-card/50 border border-border/50 shadow-2xl">
        <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6">
          <Lock size={32} />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Aplikacja Zablokowana</h1>
        <p className="text-muted-foreground text-center mb-8 text-sm">
          {isLockedOut ? <span className="text-red-500 font-medium">Zbyt wiele prób. Spróbuj ponownie za {timeLeft}s.</span> : "Podaj swój kod PIN, aby uzyskać dostęp do finansów."}
        </p>

        {/* Wskaźniki PINu */}
        <div className="flex gap-3 mb-8 h-8">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-primary scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-muted border border-border'}`}
            />
          ))}
        </div>

        {error && !isLockedOut && (
          <div className="flex items-center gap-2 text-red-500 text-sm mb-4 animate-in shake">
            <ShieldAlert size={16} /> Błędny kod PIN
          </div>
        )}

        {/* Klawiatura Numeryczna */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="w-16 h-16 rounded-full bg-muted/50 hover:bg-muted text-xl font-semibold flex items-center justify-center transition-colors focus:ring-2 focus:ring-primary/50"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-full bg-muted/50 hover:bg-muted text-lg font-medium flex items-center justify-center transition-colors"
          >
            Cofnij
          </button>
          <button
            onClick={() => handleKeyPress(0)}
            className="w-16 h-16 rounded-full bg-muted/50 hover:bg-muted text-xl font-semibold flex items-center justify-center transition-colors"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${pin.length >= 4 ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30' : 'bg-muted/50 text-muted-foreground cursor-not-allowed'}`}
          >
            <Unlock size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
