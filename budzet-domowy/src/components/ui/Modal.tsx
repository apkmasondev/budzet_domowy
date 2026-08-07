import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  showCloseButton?: boolean;
  /** Ustaw na false dla okien wymagających świadomej decyzji (np. ostrzeżenie o debecie). */
  closeOnBackdropClick?: boolean;
}

/**
 * Stos otwartych modali. Potrzebny, bo aplikacja świadomie nakłada okna
 * (formularz transakcji -> ostrzeżenie o ujemnym saldzie) i tylko wierzchnie
 * z nich może reagować na Escape.
 */
const modalStack: symbol[] = [];

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "md",
  className = "",
  showCloseButton = true,
  closeOnBackdropClick = true,
}) => {
  const idRef = useRef<symbol>(Symbol("modal"));

  // Rejestracja w stosie modali na czas, w którym okno jest otwarte.
  useEffect(() => {
    if (!isOpen) return;
    const id = idRef.current;
    modalStack.push(id);
    return () => {
      const index = modalStack.indexOf(id);
      if (index !== -1) modalStack.splice(index, 1);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      // Escape zamyka wyłącznie wierzchni modal. Wcześniej wszystkie otwarte okna
      // miały własny nasłuch i jedno naciśnięcie zamykało cały stos naraz.
      if (e.key === "Escape" && modalStack[modalStack.length - 1] === idRef.current) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Blokada przewijania tła, gdy cokolwiek jest otwarte.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  /**
   * Zamykanie po kliknięciu tła sprawdzamy na samym elemencie tła, a nie globalnym
   * nasłuchem `mousedown` na dokumencie.
   *
   * Poprzednia wersja używała `useClickOutside`: kliknięcie w modal nałożony na inny
   * modal było traktowane jako kliknięcie "poza" tym spodnim, więc zamykało go razem
   * z całym poddrzewem — przycisk potwierdzenia znikał zanim zdążył wystrzelić onClick.
   * W praktyce potwierdzenie ujemnego salda nie zapisywało transakcji.
   */
  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdropClick) return;
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className={`bg-card border border-border/50 p-8 rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {(title || showCloseButton) && (
          <div className="flex justify-between items-start mb-6">
            {title && (
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-full transition-colors ml-auto -mr-2 -mt-2"
                aria-label="Zamknij"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
};
