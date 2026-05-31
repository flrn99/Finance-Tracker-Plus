import { createContext, useContext, useState, type ReactNode } from "react";

export type Currency = "GTQ" | "USD" | "EUR" | "MXN" | "COP" | "ARS" | "CLP" | "PEN" | "BRL" | "GBP";

export const CURRENCY_INFO: Record<Currency, { symbol: string; label: string }> = {
  GTQ: { symbol: "Q", label: "Quetzal (GTQ)" },
  USD: { symbol: "$", label: "US Dollar (USD)" },
  EUR: { symbol: "€", label: "Euro (EUR)" },
  MXN: { symbol: "$", label: "Peso Mexicano (MXN)" },
  COP: { symbol: "$", label: "Peso Colombiano (COP)" },
  ARS: { symbol: "$", label: "Peso Argentino (ARS)" },
  CLP: { symbol: "$", label: "Peso Chileno (CLP)" },
  PEN: { symbol: "S/", label: "Sol Peruano (PEN)" },
  BRL: { symbol: "R$", label: "Real Brasileño (BRL)" },
  GBP: { symbol: "£", label: "British Pound (GBP)" },
};

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatAmount: (amount: number) => string;
  symbol: string;
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

  const symbol = CURRENCY_INFO[currency].symbol;

  const formatAmount = (amount: number): string => {
    return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}