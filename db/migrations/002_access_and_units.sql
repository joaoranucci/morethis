-- Better Auth core schema; names explicitly configured in src/server/auth.ts.
CREATE TABLE auth_users (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false, image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (
  id text PRIMARY KEY, "userId" text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE, "expiresAt" timestamptz NOT NULL,
  "ipAddress" text, "userAgent" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions("userId");
CREATE TABLE auth_accounts (
  id text PRIMARY KEY, "userId" text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  "accountId" text NOT NULL, "providerId" text NOT NULL,
  "accessToken" text, "refreshToken" text, "idToken" text,
  "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz,
  scope text, password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("providerId", "accountId")
);
CREATE INDEX auth_accounts_user_idx ON auth_accounts("userId");
CREATE TABLE auth_verifications (
  id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verification_identifier_idx ON auth_verifications(identifier);
CREATE TABLE auth_rate_limits (
  id text PRIMARY KEY, key text NOT NULL UNIQUE, count integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

ALTER TABLE memberships DROP CONSTRAINT memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('owner','manager','cashier','attendant','kitchen','courier','admin','member'));
ALTER TABLE memberships ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN created_by uuid REFERENCES users(id);
ALTER TABLE organizations ADD COLUMN creation_key uuid UNIQUE;
ALTER TABLE organizations ADD COLUMN creation_hash text;

CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  locale text NOT NULL DEFAULT 'pt-BR' CHECK (locale = 'pt-BR'),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX units_name_unique ON units(organization_id,lower(name));
CREATE TABLE unit_access (
  organization_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY(organization_id,unit_id,user_id),
  FOREIGN KEY(organization_id,unit_id) REFERENCES units(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,user_id) REFERENCES memberships(organization_id,user_id) ON DELETE CASCADE
);
-- Preserve legacy organizations and their existing members' access.
INSERT INTO units(organization_id,name) SELECT id,'Unidade principal' FROM organizations;
INSERT INTO unit_access(organization_id,unit_id,user_id)
  SELECT m.organization_id,u.id,m.user_id FROM memberships m JOIN units u ON u.organization_id=m.organization_id;

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id uuid,
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,unit_id) REFERENCES units(organization_id,id)
);
CREATE INDEX audit_scope_idx ON audit_events(organization_id,created_at DESC);
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK(role IN ('manager','cashier','attendant','kitchen','courier')),
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id)
);
CREATE TABLE invitation_units (
  organization_id uuid NOT NULL, invitation_id uuid NOT NULL, unit_id uuid NOT NULL,
  PRIMARY KEY(organization_id,invitation_id,unit_id),
  FOREIGN KEY(organization_id,invitation_id) REFERENCES invitations(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,unit_id) REFERENCES units(organization_id,id)
);
