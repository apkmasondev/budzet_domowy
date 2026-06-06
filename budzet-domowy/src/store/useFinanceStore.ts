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
  setTransactionModalOpen: (isOpen: boolean) => void;
  
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
  setTransactionModalOpen: (isOpen) => set({ isTransactionModalOpen: isOpen }),
  
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
    if (savedPin === pin) {
      set({ isUnlocked: true });
      get().fetchData(true); // Load data after unlock
      return true;
    }
    return false;
  },

  setupPin: async (pin) => {
    await api.setSetting("app_pin", pin);
    set({ hasPin: true, isUnlocked: true });
  },

  removePin: async () => {
    await api.setSetting("app_pin", "");
    set({ hasPin: false });
  },

  setPrivacyMode: async (enabled) => {
    await api.setSetting("privacy_mode", enabled ? "true" : "false");
    set({ privacyMode: enabled });
  },

  factoryReset: async () => {
    await api.factoryReset();
    set({ isDataLoaded: false });
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
