import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "md",
  className = "",
  showCloseButton = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, onClose);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className={`bg-card border border-border/50 p-8 rounded-2xl shadow-2xl w-full ${maxWidthClass} animate-in zoom-in-95 duration-200 ${className}`}
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
