import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId, userEmail) => {
    try {
      // 1. Mevcut profili kontrol et
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      
      if (data) {
        setRole(data.role);
      } else {
        // 2. Profil yoksa otomatik oluştur (İlk kullanıcılar için Admin, diğerleri için Staff)
        // Not: Gerçek senaryoda burası daha kısıtlı olabilir.
        const defaultRole = userId ? 'admin' : 'staff'; 
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: userId, role: defaultRole }]);
        
        if (!insertError) setRole(defaultRole);
      }
    } catch (err) {
      console.error("Profil yönetimi hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Hızlı Giriş (Bypass) Dinleyicisi
    const handleBypass = (e) => {
      const { email, role } = e.detail;
      const mockUser = { id: '00000000-0000-0000-0000-000000000000', email: email };
      setUser(mockUser);
      setRole(role);
      setLoading(false);
      localStorage.setItem('sb-bypass-user', JSON.stringify({ user: mockUser, role }));
    };
    window.addEventListener('bypass-login', handleBypass);

    // Sayfa yenilendiğinde bypass durumunu koru
    const savedBypass = localStorage.getItem('sb-bypass-user');
    if (savedBypass) {
      try {
        const { user, role } = JSON.parse(savedBypass);
        setUser(user);
        setRole(role);
      } catch (e) {
        localStorage.removeItem('sb-bypass-user');
      }
      setLoading(false);
    } else {
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!error && session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id, session.user.email);
        } else {
          setLoading(false);
        }
      }).catch(() => setLoading(false));
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === 'SIGNED_OUT') {
           localStorage.removeItem('sb-bypass-user');
           setUser(null);
           setRole('staff');
           setLoading(false);
        } else if (session?.user) {
           setUser(session.user);
           fetchProfile(session.user.id, session.user.email);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener('bypass-login', handleBypass);
    };
  }, []);

  const value = {
    signUp: (data) => supabase.auth.signUp(data),
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signOut: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('sb-bypass-user');
        setUser(null);
        setRole('staff');
    },
    user,
    role,
    isAdmin: role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
