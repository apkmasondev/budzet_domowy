import { useEffect, useRef } from "react";

export function useFocusTrap(isActive: boolean) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (!modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    
    // Auto focus first element when activated
    if (modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        // Find first input/select to focus, or default to first focusable
        const firstInput = Array.from(focusableElements).find(el => el.tagName === 'INPUT' || el.tagName === 'SELECT');
        (firstInput || focusableElements[0])?.focus();
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive]);

  return modalRef;
}
