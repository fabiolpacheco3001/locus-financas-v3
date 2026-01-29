import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Member } from '@/types/finance';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  member: Member | null;
  householdId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberFetched, setMemberFetched] = useState(false);

  const fetchMember = async (_userId?: string) => {
    try {
      // Use RPC to get members - it returns the current user's member with is_you=true
      const { data, error } = await supabase.rpc('get_members_visible');
      
      if (error) {
        console.error('[AuthContext] RPC error:', error);
        setMember(null);
        setHouseholdId(null);
        setMemberFetched(true);
        return;
      }
      
      if (data && data.length > 0) {
        // Find the current user's member (is_you = true)
        const currentMember = data.find((m) => m.is_you);
        
        // If no member with is_you=true, try to get first member (fallback)
        if (!currentMember && data.length > 0) {
          const firstMember = data[0];
          setMember({
            ...firstMember,
            role: firstMember.role as Member['role']
          } as Member);
          setHouseholdId(firstMember.household_id);
          setMemberFetched(true);
          return;
        }
        
        if (currentMember) {
          setMember({
            ...currentMember,
            role: currentMember.role as Member['role']
          } as Member);
          setHouseholdId(currentMember.household_id);
          setMemberFetched(true);
          return;
        }
      }
      // Clear if no member found - user doesn't have a household yet
      setMember(null);
      setHouseholdId(null);
      setMemberFetched(true);
    } catch (err) {
      console.error('[AuthContext] Error fetching member:', err);
      setMemberFetched(true);
    }
  };

  const refreshMember = async () => {
    await fetchMember();
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch member in background, don't block UI
          fetchMember(session.user.id).catch(err => {
            console.error('[AuthContext] Error fetching member:', err);
          });
        } else {
          setMember(null);
          setHouseholdId(null);
        }
      }
    );

    // OPTIMIZATION: Set loading to false immediately after getting session
    // Don't wait for fetchMember to complete - it can happen in background
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Set loading to false immediately so UI can render
      setLoading(false);
      
      // Fetch member in background (non-blocking)
      if (session?.user) {
        fetchMember(session.user.id).catch(err => {
          console.error('[AuthContext] Error fetching member:', err);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // The database trigger `on_auth_user_created` automatically:
    // 1. Creates a household
    // 2. Creates an admin member
    // 3. Links user via member_identities
    // 4. Seeds categories and default account
    // So we just need to sign up - no manual RPC call needed!
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name } // This is used by handle_new_user() trigger
      }
    });

    return { error: authError };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    // 1. End Supabase session first
    await supabase.auth.signOut();
    
    // 2. Clear all local state
    setUser(null);
    setSession(null);
    setMember(null);
    setHouseholdId(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, member, householdId, loading, signIn, signUp, signInWithGoogle, signOut, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
