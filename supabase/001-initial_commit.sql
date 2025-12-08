CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) workspaces
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  owner uuid DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_pkey PRIMARY KEY (id)
);

-- 2) bases (depends on workspaces)
CREATE TABLE public.bases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  owner uuid DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  workspace_id uuid NOT NULL,
  last_opened_at timestamp with time zone,
  is_starred boolean NOT NULL DEFAULT false,
  CONSTRAINT bases_pkey PRIMARY KEY (id),
  CONSTRAINT bases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);

-- 3) profiles (depends on auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  first_name text,
  middle_name text,
  last_name text,
  avatar_url text,
  timezone text,
  locale text,
  deactivated_at timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 4) notification_preferences (depends on profiles)
CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  email_product boolean NOT NULL DEFAULT true,
  email_activity boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 5) role_tags (depends on profiles)
CREATE TABLE public.role_tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  scope_type text NOT NULL CHECK (scope_type = ANY (ARRAY['workspace', 'base'])),
  scope_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  owner_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT role_tags_pkey PRIMARY KEY (id),
  CONSTRAINT role_tags_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id)
);

-- 6) tables (depends on bases)
CREATE TABLE public.tables (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  base_id uuid NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_master_list boolean NOT NULL DEFAULT false,
  CONSTRAINT tables_pkey PRIMARY KEY (id),
  CONSTRAINT tables_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id)
);

-- 7) fields (depends on tables)
CREATE TABLE public.fields (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  table_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY[
      'text','number','date','datetime','email','phone','checkbox',
      'single_select','multi_select','link'
  ])),
  order_index integer NOT NULL DEFAULT 0,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fields_pkey PRIMARY KEY (id),
  CONSTRAINT fields_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id)
);

-- 8) records (depends on tables)
CREATE TABLE public.records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  table_id uuid NOT NULL,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT records_pkey PRIMARY KEY (id),
  CONSTRAINT records_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id)
);

-- 9) workspace_memberships (depends on workspaces, profiles)
CREATE TABLE public.workspace_memberships (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workspace_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_memberships_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT workspace_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 10) workspace_membership_role_tags (depends on workspace_memberships, role_tags)
CREATE TABLE public.workspace_membership_role_tags (
  membership_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT workspace_membership_role_tags_pkey PRIMARY KEY (membership_id, tag_id),
  CONSTRAINT workspace_membership_role_tags_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.workspace_memberships(id),
  CONSTRAINT workspace_membership_role_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.role_tags(id)
);

-- 11) base_memberships (depends on bases, profiles)
CREATE TABLE public.base_memberships (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  base_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT base_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT base_memberships_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id),
  CONSTRAINT base_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 12) base_membership_role_tags (depends on base_memberships, role_tags)
CREATE TABLE public.base_membership_role_tags (
  membership_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT base_membership_role_tags_pkey PRIMARY KEY (membership_id, tag_id),
  CONSTRAINT base_membership_role_tags_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.base_memberships(id),
  CONSTRAINT base_membership_role_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.role_tags(id)
);

-- 13) automations (depends on bases)
CREATE TABLE public.automations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  trigger jsonb NOT NULL,
  action jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  base_id uuid NOT NULL,
  CONSTRAINT automations_pkey PRIMARY KEY (id),
  CONSTRAINT automations_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id)
);

-- 14) invites (depends on workspaces, bases)
CREATE TABLE public.invites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  invited_by uuid NOT NULL DEFAULT auth.uid(),
  workspace_id uuid,
  base_id uuid,
  role text NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invites_pkey PRIMARY KEY (id),
  CONSTRAINT invites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT invites_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id)
);

-- 15) audit_logs (last because it references profiles)
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  scope_type text,
  scope_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
);
