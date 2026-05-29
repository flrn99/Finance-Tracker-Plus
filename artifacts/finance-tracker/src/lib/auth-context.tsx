import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getApiUrl } from "./api-config";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
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

async function checkAndCreateDefaultCategories(token: string) {
  const res = await fetch(getApiUrl("/api/categories"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const categories = await res.json();
  if (Array.isArray(categories) && categories.length === 0) {
    await createDefaultCategories(token);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.access_token) {
        checkAndCreateDefaultCategories(session.access_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if ((event === "SIGNED_IN") && session?.access_token) {
        checkAndCreateDefaultCategories(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
