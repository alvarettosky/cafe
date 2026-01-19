'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

type UserRole = 'admin' | 'seller' | null;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    role: UserRole;
    approved: boolean;
    isLoading: boolean;
    isAdmin: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [approved, setApproved] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setIsLoading(false);
            }
        });

        // 2. Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setRole(null);
                setApproved(false);
                setIsLoading(false);
                // Redirect to login if signed out (only on client)
                if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    router.push('/login');
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Redirigir usuarios no aprobados
    useEffect(() => {
        if (isLoading) return;

        const publicPaths = ['/login', '/pendiente'];
        const isPublicPath = publicPaths.includes(pathname);

        if (user && !approved && !isPublicPath) {
            router.push('/pendiente');
        }
    }, [user, approved, isLoading, pathname, router]);

    async function fetchUserProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, approved')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                setRole(null);
                setApproved(false);
            } else {
                setRole(data?.role as UserRole);
                setApproved(data?.approved ?? false);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const signInWithGoogle = async () => {
        // Not implemented yet, password based for now
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const value = {
        user,
        session,
        role,
        approved,
        isLoading,
        isAdmin: role === 'admin',
        signInWithGoogle,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
