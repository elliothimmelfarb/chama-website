// The Hearth's schema, as ordered idempotent migrations.
//
// Add a new entry at the end; never edit one that has shipped. Each statement
// must survive being run twice (create ... if not exists, add column if not
// exists), because two cold instances may apply the same migration at once.

export const MIGRATIONS = [
  {
    id: "001-foundation",
    statements: [
      // ---- people -------------------------------------------------------
      `create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        name text not null default '',
        avatar_url text,
        role text not null default 'guest',
        status text not null default 'active',
        timezone text not null default 'Europe/Lisbon',
        referral_code text unique,
        referred_by uuid references users(id),
        email_verified_at timestamptz,
        created_at timestamptz not null default now(),
        last_seen_at timestamptz,
        notes text not null default ''
      )`,
      `create index if not exists users_role_idx on users(role)`,
      `create index if not exists users_last_seen_idx on users(last_seen_at desc)`,

      `create table if not exists identities (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        provider text not null,
        provider_id text not null,
        email text,
        created_at timestamptz not null default now(),
        unique (provider, provider_id)
      )`,
      `create index if not exists identities_user_idx on identities(user_id)`,

      `create table if not exists credentials (
        user_id uuid primary key references users(id) on delete cascade,
        password_hash text,
        password_set_at timestamptz,
        updated_at timestamptz not null default now()
      )`,

      `create table if not exists passkeys (
        id text primary key,
        user_id uuid not null references users(id) on delete cascade,
        public_key text not null,
        counter bigint not null default 0,
        transports text[] not null default '{}',
        name text not null default '',
        created_at timestamptz not null default now(),
        last_used_at timestamptz
      )`,

      `create table if not exists login_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        token_hash text not null unique,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        last_seen_at timestamptz not null default now(),
        device text not null default '',
        country text not null default '',
        revoked_at timestamptz
      )`,
      `create index if not exists login_sessions_user_idx on login_sessions(user_id)`,

      `create table if not exists email_tokens (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        user_id uuid references users(id) on delete cascade,
        purpose text not null,
        token_hash text not null unique,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        used_at timestamptz,
        meta jsonb not null default '{}'
      )`,
      `create index if not exists email_tokens_email_idx on email_tokens(email)`,

      `create table if not exists oauth_states (
        state text primary key,
        provider text not null,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        meta jsonb not null default '{}'
      )`,

      // ---- roles and settings ------------------------------------------
      `create table if not exists roles (
        name text primary key,
        label text not null,
        description text not null default '',
        permissions text[] not null default '{}',
        position int not null default 0,
        updated_at timestamptz not null default now()
      )`,

      `create table if not exists user_permissions (
        user_id uuid not null references users(id) on delete cascade,
        permission text not null,
        granted boolean not null default true,
        primary key (user_id, permission)
      )`,

      `create table if not exists settings (
        key text primary key,
        value jsonb not null,
        updated_at timestamptz not null default now(),
        updated_by uuid references users(id)
      )`,

      // ---- commerce ---------------------------------------------------
      `create table if not exists packs (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        description text not null default '',
        sessions int not null,
        minutes int not null default 60,
        price_cents int,
        currency text not null default 'EUR',
        active boolean not null default true,
        position int not null default 0,
        created_at timestamptz not null default now()
      )`,

      `create table if not exists purchases (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        pack_id uuid references packs(id),
        pack_name text not null,
        sessions int not null,
        status text not null default 'requested',
        provider text not null default 'invoice',
        provider_ref text,
        amount_cents int,
        discount_cents int not null default 0,
        currency text not null default 'EUR',
        note text not null default '',
        created_at timestamptz not null default now(),
        paid_at timestamptz,
        voided_at timestamptz
      )`,
      `create index if not exists purchases_user_idx on purchases(user_id)`,
      `create index if not exists purchases_status_idx on purchases(status)`,

      `create table if not exists credit_ledger (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        delta int not null,
        reason text not null,
        ref_id uuid,
        note text not null default '',
        created_at timestamptz not null default now(),
        created_by uuid references users(id)
      )`,
      `create index if not exists credit_ledger_user_idx on credit_ledger(user_id)`,

      `create table if not exists referral_events (
        id uuid primary key default gen_random_uuid(),
        referrer_id uuid not null references users(id) on delete cascade,
        referred_id uuid not null references users(id) on delete cascade,
        status text not null default 'signed_up',
        reward jsonb,
        created_at timestamptz not null default now(),
        rewarded_at timestamptz,
        unique (referred_id)
      )`,

      // ---- sessions -----------------------------------------------------
      `create table if not exists availability_rules (
        id uuid primary key default gen_random_uuid(),
        weekday int not null,
        start_minute int not null,
        end_minute int not null,
        timezone text not null default 'Europe/Lisbon',
        active boolean not null default true
      )`,

      `create table if not exists availability_blocks (
        id uuid primary key default gen_random_uuid(),
        starts_at timestamptz not null,
        ends_at timestamptz not null,
        reason text not null default ''
      )`,

      `create table if not exists bookings (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        starts_at timestamptz not null,
        ends_at timestamptz not null,
        status text not null default 'scheduled',
        credit_id uuid references credit_ledger(id),
        meeting_url text,
        title text not null default '',
        client_note text not null default '',
        owner_note text not null default '',
        created_at timestamptz not null default now(),
        cancelled_at timestamptz,
        cancel_reason text not null default '',
        exclude using gist (tstzrange(starts_at, ends_at) with &&) where (status = 'scheduled')
      )`,
      `create index if not exists bookings_user_idx on bookings(user_id, starts_at)`,
      `create index if not exists bookings_starts_idx on bookings(starts_at)`,

      `create table if not exists transcripts (
        id uuid primary key default gen_random_uuid(),
        booking_id uuid references bookings(id) on delete set null,
        user_id uuid not null references users(id) on delete cascade,
        title text not null default '',
        held_at timestamptz not null default now(),
        source text not null default 'paste',
        file_url text,
        raw text not null default '',
        derived jsonb,
        derived_at timestamptz,
        derived_model text,
        status text not null default 'new',
        created_at timestamptz not null default now(),
        created_by uuid references users(id)
      )`,
      `create index if not exists transcripts_user_idx on transcripts(user_id, held_at desc)`,

      `create table if not exists follow_ups (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        transcript_id uuid references transcripts(id) on delete set null,
        owner text not null default 'client',
        text text not null,
        due_at timestamptz,
        done_at timestamptz,
        created_at timestamptz not null default now(),
        created_by uuid references users(id),
        source text not null default 'manual'
      )`,
      `create index if not exists follow_ups_user_idx on follow_ups(user_id, done_at)`,

      `create table if not exists session_notes (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        text text not null,
        created_at timestamptz not null default now(),
        created_via text not null default 'web',
        read_at timestamptz
      )`,

      // ---- the feed -------------------------------------------------------
      `create table if not exists feed_posts (
        id uuid primary key default gen_random_uuid(),
        slug text unique,
        author_id uuid references users(id),
        title text not null,
        body text not null default '',
        url text,
        kind text not null default 'note',
        visibility text not null default 'members',
        pinned boolean not null default false,
        published_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`,
      `create index if not exists feed_posts_published_idx on feed_posts(published_at desc)`,

      // ---- agents ---------------------------------------------------------
      `create table if not exists api_keys (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        name text not null,
        prefix text not null,
        key_hash text not null unique,
        scopes text[] not null default '{}',
        created_at timestamptz not null default now(),
        expires_at timestamptz,
        last_used_at timestamptz,
        revoked_at timestamptz
      )`,
      `create index if not exists api_keys_user_idx on api_keys(user_id)`,

      `create table if not exists oauth_clients (
        id text primary key,
        secret_hash text,
        name text not null,
        redirect_uris text[] not null,
        grant_types text[] not null default '{authorization_code,refresh_token}',
        token_endpoint_auth_method text not null default 'none',
        client_uri text,
        logo_uri text,
        created_at timestamptz not null default now(),
        created_by uuid references users(id)
      )`,

      `create table if not exists oauth_codes (
        code_hash text primary key,
        client_id text not null references oauth_clients(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        redirect_uri text not null,
        scopes text[] not null,
        code_challenge text not null,
        code_challenge_method text not null default 'S256',
        resource text,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        used_at timestamptz
      )`,

      `create table if not exists oauth_tokens (
        id uuid primary key default gen_random_uuid(),
        client_id text not null references oauth_clients(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        kind text not null,
        token_hash text not null unique,
        scopes text[] not null,
        parent_id uuid,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        last_used_at timestamptz,
        revoked_at timestamptz
      )`,
      `create index if not exists oauth_tokens_user_idx on oauth_tokens(user_id, client_id)`,

      // ---- the log ------------------------------------------------------
      `create table if not exists audit_log (
        id bigserial primary key,
        at timestamptz not null default now(),
        actor_user_id uuid references users(id) on delete set null,
        actor_kind text not null default 'user',
        actor_ref text,
        event text not null,
        target text,
        meta jsonb not null default '{}',
        country text not null default '',
        device text not null default ''
      )`,
      `create index if not exists audit_log_at_idx on audit_log(at desc)`,
      `create index if not exists audit_log_actor_idx on audit_log(actor_user_id, at desc)`,
      `create index if not exists audit_log_event_idx on audit_log(event, at desc)`,

      `create table if not exists rate_limits (
        key text primary key,
        window_start timestamptz not null,
        count int not null default 0
      )`
    ]
  },
  {
    id: "002-reminders",
    statements: [
      `alter table bookings add column if not exists reminded text[] not null default '{}'`
    ]
  }
];
