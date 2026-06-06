import { useDialogStore } from "../../store/useDialogStore";
import { AlertTriangle, Info, X } from "lucide-react";

export default function GlobalDialogs() {
  const { isOpen, type, title, message, onConfirm, onCancel, close } = useDialogStore();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    close();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 animate-in fade-in duration-200 p-4">
      <div className="bg-[var(--color-card)] border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 relative">
          <button 
            onClick={handleCancel}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-start gap-4 mb-2">
            <div className={`p-3 rounded-full shrink-0 ${type === 'confirm' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
              {type === 'confirm' ? <AlertTriangle size={24} /> : <Info size={24} />}
            </div>
            <div className="pt-1">
              <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">{title}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-muted/30 px-6 py-4 flex items-center justify-end gap-3 border-t border-border">
          {type === 'confirm' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              Anuluj
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-5 py-2 text-sm font-medium rounded-lg text-white shadow-sm transition-transform hover:scale-105 active:scale-95 ${
              type === 'confirm' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'
            }`}
          >
            {type === 'confirm' ? 'Zatwierdź' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
