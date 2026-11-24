-- ====================================================================
-- Hydrate: Free Serverless Postgres Schema (Neon / Lakebase)
-- Generous Free Tier: 0.5 GiB storage, scale-to-zero, $0/month forever.
-- ====================================================================

-- 1. Daily water intake records
CREATE TABLE IF NOT EXISTS daily_intake (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    intake_date DATE NOT NULL,
    ml INTEGER NOT NULL DEFAULT 0,
    goal_ml INTEGER NOT NULL DEFAULT 2500,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_date UNIQUE (user_id, intake_date)
);

CREATE INDEX IF NOT EXISTS idx_intake_user_date ON daily_intake(user_id, intake_date DESC);

-- 2. User settings & preferences
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    goal_ml INTEGER NOT NULL DEFAULT 2500,
    unit VARCHAR(10) NOT NULL DEFAULT 'ml',
    interval_min INTEGER NOT NULL DEFAULT 60,
    start_hour INTEGER NOT NULL DEFAULT 8,
    end_hour INTEGER NOT NULL DEFAULT 22,
    warnings_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reviews_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    water_sound VARCHAR(20) NOT NULL DEFAULT 'drop',
    quick_amounts INTEGER[] NOT NULL DEFAULT '{150, 250, 500}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Completed habit / reminder logs (e.g. medicine, exercise, snacks)
CREATE TABLE IF NOT EXISTS habit_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    kind VARCHAR(50) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habit_user ON habit_logs(user_id, completed_at DESC);
