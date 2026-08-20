-- ==============================================================================
-- VISOR - Supabase PostgreSQL Schema & Row Level Security (RLS) Policies
-- Run this SQL script in the Supabase SQL Editor for your project.
-- ==============================================================================

-- 1. PROFILES TABLE
-- Stores user enterprise profile information keyed to Supabase auth.users.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    company TEXT NOT NULL DEFAULT 'Global Logistics',
    role TEXT NOT NULL DEFAULT 'Analyst',
    hq_location TEXT DEFAULT 'San Francisco',
    hq_coordinates JSONB DEFAULT '[37.7749, -122.4194]'::jsonb,
    sectors TEXT[] DEFAULT ARRAY['Pharmaceuticals', 'Logistics', 'Semiconductors', 'Electronics', 'Automotive'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their LOGGED_IN profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);


-- 2. SUPPLIERS TABLE
-- Stores supplier nodes registered by the authenticated user.
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    coordinates JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'STABLE',
    contact_email TEXT,
    criticality TEXT DEFAULT 'standard',
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Suppliers Policies
DROP POLICY IF EXISTS "Users can view their own suppliers" ON public.suppliers;
CREATE POLICY "Users can view their own suppliers"
    ON public.suppliers FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own suppliers" ON public.suppliers;
CREATE POLICY "Users can insert their own suppliers"
    ON public.suppliers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own suppliers" ON public.suppliers;
CREATE POLICY "Users can update their own suppliers"
    ON public.suppliers FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own suppliers" ON public.suppliers;
CREATE POLICY "Users can delete their own suppliers"
    ON public.suppliers FOR DELETE
    USING (auth.uid() = user_id);


-- 3. STATUS_OVERRIDES TABLE
-- Stores manual risk status overrides set by the user.
CREATE TABLE IF NOT EXISTS public.status_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, supplier_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.status_overrides ENABLE ROW LEVEL SECURITY;

-- Status Overrides Policies
DROP POLICY IF EXISTS "Users can view their own status overrides" ON public.status_overrides;
CREATE POLICY "Users can view their own status overrides"
    ON public.status_overrides FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own status overrides" ON public.status_overrides;
CREATE POLICY "Users can insert/update their own status overrides"
    ON public.status_overrides FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own status overrides" ON public.status_overrides;
CREATE POLICY "Users can update their own status overrides"
    ON public.status_overrides FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own status overrides" ON public.status_overrides;
CREATE POLICY "Users can delete their own status overrides"
    ON public.status_overrides FOR DELETE
    USING (auth.uid() = user_id);
