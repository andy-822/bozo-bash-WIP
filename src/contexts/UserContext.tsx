'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserContextType {
    currentUser: SupabaseUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
    children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
    const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setCurrentUser(session?.user ?? null);
            setLoading(false);
        };

        getSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setCurrentUser(session?.user ?? null);
                setLoading(false);

                // Create user profile if new user
                if (event === 'SIGNED_IN' && session?.user) {
                    await createUserProfile(session.user);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const createUserProfile = async (user: SupabaseUser) => {
        try {
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .single();

            if (!existingUser) {
                // Build the payload
                const payload = {
                    id: user.id,
                    email: user.email!,
                    name: user.user_metadata?.full_name || user.email!.split('@')[0],
                    avatar_url: user.user_metadata?.avatar_url ?? null,
                };

                // Keep it simple: avoid generics/comments in a chain that can confuse TSX parsing
                await (supabase.from('users') as any).insert([payload]);
            }

        } catch (error) {
            console.error('Error creating user profile:', error);
        }
    };

    const signInWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('Error signing in with Google:', error);
        }
    };

    const logout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const isAuthenticated = currentUser !== null;

    return (
        <UserContext.Provider value={{
            currentUser,
            loading,
            signInWithGoogle,
            logout,
            isAuthenticated
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}