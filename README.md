# FurShop 🐾

AI-powered pet product discovery for dogs and cats. Users describe what their pet needs, and an AI chatbot finds real products from the internet with prices and links.

## Tech Stack

- **Next.js 14** (App Router, JavaScript)
- **Supabase** (PostgreSQL + Auth)
- **Groq API** (llama-3.3-70b-versatile)
- **Serper API** (Google Shopping search)
- **Vercel** (deployment)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
SERPER_API_KEY=your_serper_api_key
```

> **Note:** `GROQ_API_KEY` and `SERPER_API_KEY` are server-side only — do NOT add the `NEXT_PUBLIC_` prefix.

### 3. Set up Supabase database

Run the following SQL in your Supabase SQL editor:

```sql
create table if not exists user_collections (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null unique,
  items      jsonb not null default '[]',
  updated_at timestamptz default now()
);
alter table user_collections enable row level security;
create policy "select own" on user_collections for select using (auth.uid() = user_id);
create policy "insert own" on user_collections for insert with check (auth.uid() = user_id);
create policy "update own" on user_collections for update using (auth.uid() = user_id);
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Build

```bash
npm run build
```

## Features

- **AI Chat**: Describe your pet's needs and get real product recommendations
- **Pet Filter**: Filter products by Dog or Cat
- **Best Value Badge**: The cheapest item in each set is highlighted
- **Saved Tab**: All discovered products are automatically saved and persist across sessions
- **Auth**: Sign up / log in with email and password via Supabase
- **Dark/Light Mode**: Theme toggle

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add all environment variables in Vercel project settings
4. Deploy

## API Keys

- **Groq**: [https://console.groq.com](https://console.groq.com)
- **Serper**: [https://serper.dev](https://serper.dev)
- **Supabase**: [https://supabase.com](https://supabase.com)
