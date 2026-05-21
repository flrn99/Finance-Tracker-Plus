import { createContext, useContext, useState, type ReactNode } from "react";

export type Currency = "USD" | "GTQ";

const RATES: Record<Currency, number> = {
  USD: 1,
  GTQ: 7.75,
};

const SYMBOLS: Record<Currency, string> = {
  USD: "$",
  GTQ: "Q",
};

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatAmount: (usdAmount: number) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("USD");

  const formatAmount = (usdAmount: number): string => {
    const converted = usdAmount * RATES[currency];
    const symbol = SYMBOLS[currency];
    return `${symbol}${converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, symbol: SYMBOLS[currency] }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
