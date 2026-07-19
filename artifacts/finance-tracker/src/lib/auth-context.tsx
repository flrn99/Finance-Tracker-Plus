import { createContext, useContext, useEffect, useState, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getApiUrl } from "./api-config";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  /** true una vez que confirmamos que esta cuenta no tenía categorías (recién
   * creada) — hasta que se llame acknowledgeOnboarded(). Ver checkAndCreateCategories:
   * ya hacía exactamente esta detección para sembrar las categorías default,
   * así que la reusamos en vez de inventar un flag de localStorage aparte. */
  isNewAccount: boolean;
  acknowledgeOnboarded: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  isNewAccount: false,
  acknowledgeOnboarded: () => {},
});

const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", type: "expense", color: "#ef4444", icon: "utensils" },
  { name: "Transport", type: "expense", color: "#f97316", icon: "car" },
  { name: "Entertainment", type: "expense", color: "#8b5cf6", icon: "tv" },
  { name: "Shopping", type: "expense", color: "#ec4899", icon: "shopping-bag" },
  { name: "Health", type: "expense", color: "#14b8a6", icon: "heart" },
  { name: "Bills & Utilities", type: "expense", color: "#64748b", icon: "zap" },
  { name: "Education", type: "expense", color: "#0ea5e9", icon: "book" },
  { name: "Other", type: "both", color: "#6b7280", icon: "more-horizontal" },
  { name: "Salary", type: "income", color: "#22c55e", icon: "briefcase" },
  { name: "Freelance", type: "income", color: "#a3e635", icon: "laptop" },
];

async function createDefaultCategories(token: string) {
  for (const category of DEFAULT_CATEGORIES) {
    await fetch(getApiUrl("/api/categories"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(category),
    });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const categoriesChecked = useRef<Set<string>>(new Set());

  const checkAndCreateCategories = async (token: string, userId: string) => {
    if (categoriesChecked.current.has(userId)) return;
    categoriesChecked.current.add(userId);

    const res = await fetch(getApiUrl("/api/categories"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const categories = await res.json();
    if (Array.isArray(categories) && categories.length === 0) {
      await createDefaultCategories(token);
      setIsNewAccount(true);
    }
  };

  const acknowledgeOnboarded = () => setIsNewAccount(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.access_token && session?.user?.id) {
        checkAndCreateCategories(session.access_token, session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.access_token && session?.user?.id) {
        checkAndCreateCategories(session.access_token, session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut, isNewAccount, acknowledgeOnboarded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
