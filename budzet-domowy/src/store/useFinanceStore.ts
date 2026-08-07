import { create } from "zustand";
import { api } from "../lib/api";

interface FinanceState {
  isDataLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  currentMonth: string;
  autoProcessedCount: number;

  // Global Modals
  isTransactionModalOpen: boolean;
  editingTransactionId: number | null;
  setTransactionModalOpen: (isOpen: boolean, editId?: number | null) => void;
  
  // Security & Privacy
  privacyMode: boolean;
  isUnlocked: boolean;
  hasPin: boolean;
  checkAuthStatus: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  setPrivacyMode: (enabled: boolean) => Promise<void>;
  
  // System
  factoryReset: () => Promise<void>;
  
  fetchData: (force?: boolean) => Promise<void>;

  dismissAutoProcessNotification: () => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  isDataLoaded: false,
  isLoading: false,
  error: null,
  currentMonth: new Date().toISOString().slice(0, 7),
  autoProcessedCount: 0,
  
  isTransactionModalOpen: false,
  editingTransactionId: null,
  setTransactionModalOpen: (isOpen, editId = null) => set({ isTransactionModalOpen: isOpen, editingTransactionId: editId }),
  
  privacyMode: false,
  isUnlocked: false,
  hasPin: false,

  checkAuthStatus: async () => {
    try {
      const pinSetting = await api.getSetting("app_pin");
      const privacySetting = await api.getSetting("privacy_mode");
      
      const hasPin = pinSetting !== null && pinSetting.length > 0;
      set({ 
        hasPin, 
        isUnlocked: !hasPin, // If no PIN, unlocked by default
        privacyMode: privacySetting === "true" 
      });
      
      if (!hasPin) {
        get().fetchData(true);
      }
    } catch (e) {
      console.error("Failed to load auth status", e);
    }
  },

  unlock: async (pin) => {
    const savedPin = await api.getSetting("app_pin");
    if (!savedPin) return false;

    const savedSalt = await api.getSetting("app_pin_salt");
    const encoder = new TextEncoder();
    
    let isMatch = false;

    if (savedSalt) {
      const data = encoder.encode(savedSalt + pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedPin = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      if (savedPin === hashedPin) {
        set({ isUnlocked: true });
        get().fetchData(true);
        return true;
      }
    }

    const legacyData = encoder.encode(pin);
    const legacyHashBuffer = await crypto.subtle.digest('SHA-256', legacyData);
    const legacyHashArray = Array.from(new Uint8Array(legacyHashBuffer));
    const legacyHashedPin = legacyHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (savedPin === legacyHashedPin) {
      isMatch = true;
    }

    if (savedPin === pin) {
      isMatch = true;
    }

    if (isMatch) {
      const randomValues = crypto.getRandomValues(new Uint8Array(16));
      const saltArray = Array.from(randomValues);
      const newSalt = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const dataToHash = encoder.encode(newSalt + pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newHashedPin = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      await api.setSetting("app_pin_salt", newSalt);
      await api.setSetting("app_pin", newHashedPin);

      set({ isUnlocked: true });
      get().fetchData(true);
      return true;
    }

    return false;
  },

  setupPin: async (pin) => {
    const encoder = new TextEncoder();
    const randomValues = crypto.getRandomValues(new Uint8Array(16));
    const saltArray = Array.from(randomValues);
    const newSalt = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
    const dataToHash = encoder.encode(newSalt + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPin = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    await api.setSetting("app_pin_salt", newSalt);
    await api.setSetting("app_pin", hashedPin);
    set({ hasPin: true, isUnlocked: true });
  },

  removePin: async () => {
    await api.setSetting("app_pin", "");
    await api.setSetting("app_pin_salt", "");
    // isUnlocked musi zostać ustawione jawnie: bez PIN-u aplikacja jest zawsze odblokowana.
    set({ hasPin: false, isUnlocked: true });
  },

  setPrivacyMode: async (enabled) => {
    await api.setSetting("privacy_mode", enabled ? "true" : "false");
    set({ privacyMode: enabled });
  },

  factoryReset: async () => {
    await api.factoryReset();
    set({ isDataLoaded: false });
    // Reset czyści też część ustawień w bazie, więc stan bezpieczeństwa trzeba
    // odczytać na nowo zamiast trzymać nieaktualną kopię w pamięci.
    await get().checkAuthStatus();
    await get().fetchData(true);
  },

  fetchData: async (force = false) => {
    if (!get().isUnlocked) return; 
    if (get().isDataLoaded && !force) return; 

    set({ isLoading: true, error: null });
    try {
      const processedCount = await api.processRecurrings();
      
      set({ 
        autoProcessedCount: processedCount,
        isDataLoaded: true,
        isLoading: false,
        error: null
      });
    } catch (error: any) {
      console.error(error);
      set({ error: error.toString(), isLoading: false });
    }
  },

  dismissAutoProcessNotification: () => {
    set({ autoProcessedCount: 0 });
  }
}));
