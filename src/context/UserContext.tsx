// src/context/UserContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface UserContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  session: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data?.session ?? null);
    setUser(data?.session?.user ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, session, loading, refresh, signOut }),
    [user, session, loading, refresh, signOut]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => useContext(UserContext);
