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
  rate: number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      return (localStorage.getItem("ff-currency") as Currency) ?? "GTQ";
    } catch {
      return "GTQ";
    }
  });

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem("ff-currency", c); } catch {}
  };

  const rate = RATES[currency];
  const symbol = SYMBOLS[currency];

  const formatAmount = (usdAmount: number): string => {
    const converted = usdAmount * rate;
    return `${symbol}${converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, symbol, rate }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
