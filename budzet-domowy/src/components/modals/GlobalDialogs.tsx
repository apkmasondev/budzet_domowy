import { useDialogStore } from "../../store/useDialogStore";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

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
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      maxWidth="md"
      showCloseButton={true}
    >
      <div className="flex items-start gap-4 mb-2">
        <div className={`p-3 rounded-full shrink-0 ${type === 'confirm' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
          {type === 'confirm' ? <AlertTriangle size={24} /> : <Info size={24} />}
        </div>
        <div className="pt-1">
          <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">{title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        </div>
      </div>
      
      <div className="flex justify-end gap-3 mt-6">
        {type === 'confirm' && (
          <Button onClick={handleCancel} variant="ghost">
            Anuluj
          </Button>
        )}
        <Button 
          onClick={handleConfirm} 
          variant={type === 'confirm' ? 'danger' : 'primary'}
        >
          {type === 'confirm' ? 'Zatwierdź' : 'OK'}
        </Button>
      </div>
    </Modal>
  );
}
