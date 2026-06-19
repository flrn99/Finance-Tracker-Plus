import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

// ── Types ────────────────────────────────────────────────────────────────────
interface BiometricContextType {
  isEnabled: boolean;
  isLocked: boolean;
  isSupported: boolean;
  unlock: () => void;
  enable: (pin: string) => Promise<{ success: boolean; error?: string }>;
  disable: (pin: string) => boolean;
  triggerAuth: () => Promise<boolean>;
}

const BiometricContext = createContext<BiometricContextType>({
  isEnabled: false,
  isLocked: false,
  isSupported: false,
  unlock: () => {},
  enable: async () => ({ success: false }),
  disable: () => false,
  triggerAuth: async () => false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const STORAGE_KEY_ENABLED = "ff-biometric-enabled";
const STORAGE_KEY_PIN = "ff-biometric-pin";
const BACKGROUND_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function getStoredPin(): string | null {
  try { return localStorage.getItem(STORAGE_KEY_PIN); } catch { return null; }
}

function savePin(pin: string) {
  try { localStorage.setItem(STORAGE_KEY_PIN, pin); } catch {}
}

function isStoredEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY_ENABLED) === "true"; } catch { return false; }
}

function setStoredEnabled(val: boolean) {
  try { localStorage.setItem(STORAGE_KEY_ENABLED, val ? "true" : "false"); } catch {}
}

// ── Biometric auth via @capacitor-community/biometric-auth ───────────────────
async function checkBiometricAvailable(): Promise<{ available: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) return { available: false, error: "not_native" };
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const result = await BiometricAuth.checkBiometry();
    if (!result.isAvailable) {
      return { available: false, error: result.reason ?? "unavailable" };
    }
    return { available: true };
  } catch {
    return { available: false, error: "plugin_error" };
  }
}

async function requestBiometricAuth(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    await BiometricAuth.authenticate({
      reason: "Verify your identity to access Flow Finance",
      cancelTitle: "Use PIN instead",
      allowDeviceCredential: false,
      iosFallbackTitle: "Use PIN instead",
    });
    return true;
  } catch {
    return false;
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function BiometricProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(isStoredEnabled);
  const [isLocked, setIsLocked] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const didInitialLock = useRef(false);

  // Check if device supports biometrics
  useEffect(() => {
    checkBiometricAvailable().then(({ available }) => setIsSupported(available));
  }, []);

  // Lock on first load if enabled
  useEffect(() => {
    if (isEnabled && !didInitialLock.current) {
      didInitialLock.current = true;
      setIsLocked(true);
    }
  }, [isEnabled]);

  // Lock after 5min in background
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupAppState = async () => {
      try {
        const { App } = await import("@capacitor/app");
        App.addListener("appStateChange", ({ isActive }) => {
          if (!isEnabled) return;
          if (!isActive) {
            backgroundedAt.current = Date.now();
          } else {
            const bg = backgroundedAt.current;
            if (bg && Date.now() - bg >= BACKGROUND_TIMEOUT_MS) {
              setIsLocked(true);
            }
            backgroundedAt.current = null;
          }
        });
      } catch {}
    };

    setupAppState();
  }, [isEnabled]);

  const unlock = () => setIsLocked(false);

  const triggerAuth = async (): Promise<boolean> => {
    const success = await requestBiometricAuth();
    if (success) unlock();
    return success;
  };

  const enable = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    const { available, error } = await checkBiometricAvailable();
    if (!available) {
      if (error === "not_native") return { success: false, error: "biometrics_not_native" };
      return { success: false, error: "biometrics_not_configured" };
    }
    // Test auth before enabling
    const authed = await requestBiometricAuth();
    if (!authed) return { success: false, error: "auth_failed" };

    savePin(pin);
    setStoredEnabled(true);
    setIsEnabled(true);
    return { success: true };
  };

  const disable = (pin: string): boolean => {
    const stored = getStoredPin();
    if (pin !== stored) return false;
    setStoredEnabled(false);
    setIsEnabled(false);
    setIsLocked(false);
    try { localStorage.removeItem(STORAGE_KEY_PIN); } catch {}
    return true;
  };

  return (
    <BiometricContext.Provider value={{ isEnabled, isLocked, isSupported, unlock, enable, disable, triggerAuth }}>
      {children}
    </BiometricContext.Provider>
  );
}

export function useBiometric() {
  return useContext(BiometricContext);
}

export { getStoredPin };
