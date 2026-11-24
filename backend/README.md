# Hydrate - Free Backend Setup (Neon Serverless Postgres)

Hydrate is 100% offline-first and requires **$0 to run**. All user water logs, goals, and notification schedules are saved locally on the device using SQLite/AsyncStorage.

If you want **free cloud backup & multi-device sync**, you can connect a completely free serverless Postgres database using **[Neon](https://neon.tech)** (Lakebase Postgres).

---

## Why Neon?
- **100% Free Tier**: 0.5 GiB storage, up to 10 projects, scale-to-zero when not in use.
- **Zero Server Costs**: Runs serverlessly via HTTP SQL API — no server, VPS, or maintenance required.
- **No Credit Card Required**: Free forever tier.

---

## 30-Second Setup Guide

### 1. Create your Free Database
1. Go to **[neon.tech](https://neon.tech)** and sign up with GitHub or Google (takes 10 seconds).
2. Click **Create Project**, name it `hydrate-db`, and choose your nearest region.

### 2. Run the Schema Migration
1. In the Neon Console, click **SQL Editor** on the left menu.
2. Copy and paste the contents of [`backend/schema.sql`](file:///e:/ho2%20reminder/backend/schema.sql):
   - Creates `daily_intake`, `user_settings`, and `habit_logs`.
3. Click **Run**.

### 3. Connect in the Hydrate App
1. From the Neon Dashboard, copy your connection string:
   ```text
   postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require
   ```
2. Open **Hydrate** -> **Settings** -> **Cloud Backup & Sync**.
3. Paste the URL and tap **Test & Connect**.
4. Tap **Sync Now** to backup your local water history to the cloud.
