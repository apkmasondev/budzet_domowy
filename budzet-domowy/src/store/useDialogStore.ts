import { create } from "zustand";

interface DialogState {
  isOpen: boolean;
  type: "confirm" | "alert";
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;

  showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
  showAlert: (title: string, message: string, onConfirm?: () => void) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  isOpen: false,
  type: "alert",
  title: "",
  message: "",

  showConfirm: (title, message, onConfirm, onCancel) => set({
    isOpen: true,
    type: "confirm",
    title,
    message,
    onConfirm,
    onCancel
  }),

  showAlert: (title, message, onConfirm) => set({
    isOpen: true,
    type: "alert",
    title,
    message,
    onConfirm,
    onCancel: undefined
  }),

  close: () => set({ isOpen: false })
}));
