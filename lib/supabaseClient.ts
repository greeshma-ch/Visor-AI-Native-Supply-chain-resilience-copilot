import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Supplier, User, Role, RiskStatus } from '../types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ─── AUTHENTICATION HELPERS ──────────────────────────────────────

export const signInWithPassword = async (email: string, password: string) => {
  if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signUpWithPassword = async (
  email: string,
  password: string,
  profile: {
    company: string;
    role: Role;
    hqLocation: string;
    hqCoordinates?: [number, number];
    sectors?: string[];
  }
) => {
  if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company: profile.company,
        role: profile.role,
        hqLocation: profile.hqLocation,
        hqCoordinates: profile.hqCoordinates,
        sectors: profile.sectors
      }
    }
  });

  if (error) throw error;

  if (data.user) {
    // Also insert or upsert the profile in the profiles table
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        company: profile.company,
        role: profile.role,
        hq_location: profile.hqLocation,
        hq_coordinates: profile.hqCoordinates,
        sectors: profile.sectors || ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive'],
        updated_at: new Date().toISOString()
      });
    } catch (profileErr) {
      console.warn("Failed to create profile row, user_metadata will serve as fallback:", profileErr);
    }
  }

  return data;
};

export const signOut = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Supabase signOut error:", error);
};

export const getSupabaseSession = async () => {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Supabase getSession error:", error);
    return null;
  }
  return session;
};

// ─── PROFILE PERSISTENCE ─────────────────────────────────────────

export const fetchUserProfile = async (userId: string): Promise<User | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email,
      company: data.company || 'Enterprise',
      role: (data.role as Role) || 'Analyst',
      hqLocation: data.hq_location || 'Global',
      hqCoordinates: data.hq_coordinates,
      sectors: data.sectors || ['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive']
    };
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
};

export const upsertUserProfile = async (user: User): Promise<void> => {
  if (!supabase || !user.id) return;
  try {
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      company: user.company,
      role: user.role,
      hq_location: user.hqLocation,
      hq_coordinates: user.hqCoordinates,
      sectors: user.sectors,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
  }
};

// ─── SUPPLIERS PERSISTENCE ───────────────────────────────────────

export const fetchUserSuppliers = async (userId: string): Promise<Supplier[] | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return null;

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      location: row.location,
      coordinates: row.coordinates,
      status: row.status as RiskStatus,
      contactEmail: row.contact_email || '',
      criticality: row.criticality || 'standard',
      lastUpdated: row.last_updated || new Date().toISOString()
    }));
  } catch (err) {
    console.error("Error fetching suppliers from Supabase:", err);
    return null;
  }
};

export const insertUserSupplier = async (userId: string, supplier: Supplier): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('suppliers').insert({
      id: supplier.id,
      user_id: userId,
      name: supplier.name,
      category: supplier.category,
      location: supplier.location,
      coordinates: supplier.coordinates,
      status: supplier.status,
      contact_email: supplier.contactEmail,
      criticality: supplier.criticality || 'standard',
      last_updated: supplier.lastUpdated || new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    if (error) throw error;
  } catch (err) {
    console.error("Error inserting supplier into Supabase:", err);
  }
};

export const seedUserSuppliersIfEmpty = async (userId: string, defaultSuppliers: Supplier[]): Promise<Supplier[]> => {
  if (!supabase) return defaultSuppliers;
  try {
    const existing = await fetchUserSuppliers(userId);
    if (existing && existing.length > 0) {
      return existing;
    }

    const payload = defaultSuppliers.map((s) => ({
      id: s.id,
      user_id: userId,
      name: s.name,
      category: s.category,
      location: s.location,
      coordinates: s.coordinates,
      status: s.status,
      contact_email: s.contactEmail,
      criticality: s.criticality || 'standard',
      last_updated: s.lastUpdated || new Date().toISOString(),
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('suppliers').insert(payload);
    if (error) {
      console.warn("Failed to seed default suppliers in Supabase:", error.message);
      return defaultSuppliers;
    }
    return defaultSuppliers;
  } catch (err) {
    console.error("Error seeding default suppliers:", err);
    return defaultSuppliers;
  }
};

// ─── STATUS OVERRIDES PERSISTENCE ────────────────────────────────

export const fetchUserStatusOverrides = async (userId: string): Promise<Record<string, RiskStatus> | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('status_overrides')
      .select('supplier_id, status')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data) return null;

    const map: Record<string, RiskStatus> = {};
    for (const row of data) {
      map[row.supplier_id] = row.status as RiskStatus;
    }
    return map;
  } catch (err) {
    console.error("Error fetching status overrides from Supabase:", err);
    return null;
  }
};

export const upsertUserStatusOverride = async (
  userId: string,
  supplierId: string,
  status: RiskStatus
): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('status_overrides').upsert(
      {
        user_id: userId,
        supplier_id: supplierId,
        status,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,supplier_id' }
    );
    if (error) throw error;

    // Also update suppliers table status if present
    await supabase.from('suppliers')
      .update({ status, last_updated: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', supplierId);
  } catch (err) {
    console.error("Error upserting status override in Supabase:", err);
  }
};
