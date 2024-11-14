import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  foreignKey,
  inet,
  integer,
  json,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const auth = pgSchema("auth");
export const drizzle = pgSchema("drizzle");
export const extensions = pgSchema("extensions");
export const graphql = pgSchema("graphql");
export const graphqlPublic = pgSchema("graphql_public");
export const pgbouncer = pgSchema("pgbouncer");
export const pgsodium = pgSchema("pgsodium");
export const pgsodiumMasks = pgSchema("pgsodium_masks");
export const realtime = pgSchema("realtime");
export const storage = pgSchema("storage");
export const supabaseMigrations = pgSchema("supabase_migrations");
export const vault = pgSchema("vault");

export const factorTypeInAuth = auth.enum("factor_type", [
  "totp",
  "webauthn",
  "phone",
]);
export const factorStatusInAuth = auth.enum("factor_status", [
  "unverified",
  "verified",
]);
export const aalLevelInAuth = auth.enum("aal_level", ["aal1", "aal2", "aal3"]);
export const codeChallengeMethodInAuth = auth.enum("code_challenge_method", [
  "s256",
  "plain",
]);
export const oneTimeTokenTypeInAuth = auth.enum("one_time_token_type", [
  "confirmation_token",
  "reauthentication_token",
  "recovery_token",
  "email_change_token_new",
  "email_change_token_current",
  "phone_change_token",
]);
export const keyStatusInPgsodium = pgsodium.enum("key_status", [
  "default",
  "valid",
  "invalid",
  "expired",
]);
export const keyTypeInPgsodium = pgsodium.enum("key_type", [
  "aead-ietf",
  "aead-det",
  "hmacsha512",
  "hmacsha256",
  "auth",
  "shorthash",
  "generichash",
  "kdf",
  "secretbox",
  "secretstream",
  "stream_xchacha20",
]);
export const contentStatus = pgEnum("content_status", [
  "draft",
  "published",
  "archived",
]);
export const equalityOpInRealtime = realtime.enum("equality_op", [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
]);
export const actionInRealtime = realtime.enum("action", [
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "ERROR",
]);

export const usersInAuth = auth.table(
  "users",
  {
    instanceId: uuid("instance_id"),
    id: uuid("id").primaryKey().notNull(),
    aud: varchar("aud", { length: 255 }),
    role: varchar("role", { length: 255 }),
    email: varchar("email", { length: 255 }),
    encryptedPassword: varchar("encrypted_password", { length: 255 }),
    emailConfirmedAt: timestamp("email_confirmed_at", {
      withTimezone: true,
      mode: "string",
    }),
    invitedAt: timestamp("invited_at", { withTimezone: true, mode: "string" }),
    confirmationToken: varchar("confirmation_token", { length: 255 }),
    confirmationSentAt: timestamp("confirmation_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    recoveryToken: varchar("recovery_token", { length: 255 }),
    recoverySentAt: timestamp("recovery_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    emailChangeTokenNew: varchar("email_change_token_new", { length: 255 }),
    emailChange: varchar("email_change", { length: 255 }),
    emailChangeSentAt: timestamp("email_change_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastSignInAt: timestamp("last_sign_in_at", {
      withTimezone: true,
      mode: "string",
    }),
    rawAppMetaData: jsonb("raw_app_meta_data"),
    rawUserMetaData: jsonb("raw_user_meta_data"),
    isSuperAdmin: boolean("is_super_admin"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    phone: text("phone").default(sql`NULL::character varying`),
    phoneConfirmedAt: timestamp("phone_confirmed_at", {
      withTimezone: true,
      mode: "string",
    }),
    phoneChange: text("phone_change").default(sql`''::character varying`),
    phoneChangeToken: varchar("phone_change_token", { length: 255 }).default(
      sql`''::character varying`,
    ),
    phoneChangeSentAt: timestamp("phone_change_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
      mode: "string",
    })
      .default(sql`LEAST(email_confirmed_at, phone_confirmed_at)`)
      .generatedAlwaysAs(sql`LEAST(email_confirmed_at, phone_confirmed_at)`),
    emailChangeTokenCurrent: varchar("email_change_token_current", {
      length: 255,
    }).default(sql`''::character varying`),
    emailChangeConfirmStatus: smallint("email_change_confirm_status").default(
      sql`0`,
    ),
    bannedUntil: timestamp("banned_until", {
      withTimezone: true,
      mode: "string",
    }),
    reauthenticationToken: varchar("reauthentication_token", {
      length: 255,
    }).default(sql`''::character varying`),
    reauthenticationSentAt: timestamp("reauthentication_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    isSsoUser: boolean("is_sso_user").default(sql`false`).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    isAnonymous: boolean("is_anonymous").default(sql`false`).notNull(),
  },
  (table) => {
    return {
      usersPhoneKey: unique("users_phone_key").on(table.phone),
    };
  },
);

export const refreshTokensInAuth = auth.table(
  "refresh_tokens",
  {
    instanceId: uuid("instance_id"),
    id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
    token: varchar("token", { length: 255 }),
    userId: varchar("user_id", { length: 255 }),
    revoked: boolean("revoked"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    parent: varchar("parent", { length: 255 }),
    sessionId: uuid("session_id").references(() => sessionsInAuth.id, {
      onDelete: "cascade",
    }),
  },
  (table) => {
    return {
      refreshTokensTokenUnique: unique("refresh_tokens_token_unique").on(
        table.token,
      ),
    };
  },
);

export const instancesInAuth = auth.table("instances", {
  id: uuid("id").primaryKey().notNull(),
  uuid: uuid("uuid"),
  rawBaseConfig: text("raw_base_config"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
});

export const auditLogEntriesInAuth = auth.table("audit_log_entries", {
  instanceId: uuid("instance_id"),
  id: uuid("id").primaryKey().notNull(),
  payload: json("payload"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  ipAddress: varchar("ip_address", { length: 64 })
    .default(sql`''::character varying`)
    .notNull(),
});

export const schemaMigrationsInAuth = auth.table("schema_migrations", {
  version: varchar("version", { length: 255 }).primaryKey().notNull(),
});

export const identitiesInAuth = auth.table(
  "identities",
  {
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    identityData: jsonb("identity_data").notNull(),
    provider: text("provider").notNull(),
    lastSignInAt: timestamp("last_sign_in_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    email: text("email")
      .default(sql`lower((identity_data ->> 'email'::text))`)
      .generatedAlwaysAs(sql`lower((identity_data ->> 'email'::text))`),
    id: uuid("id").defaultRandom().primaryKey().notNull(),
  },
  (table) => {
    return {
      identitiesProviderIdProviderUnique: unique(
        "identities_provider_id_provider_unique",
      ).on(table.providerId, table.provider),
    };
  },
);

export const sessionsInAuth = auth.table("sessions", {
  id: uuid("id").primaryKey().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersInAuth.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  factorId: uuid("factor_id"),
  aal: customType({ dataType: () => "auth.aal_level" })("aal"),
  notAfter: timestamp("not_after", { withTimezone: true, mode: "string" }),
  refreshedAt: timestamp("refreshed_at", { mode: "string" }),
  userAgent: text("user_agent"),
  ip: inet("ip"),
  tag: text("tag"),
});

export const mfaFactorsInAuth = auth.table(
  "mfa_factors",
  {
    id: uuid("id").primaryKey().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInAuth.id, { onDelete: "cascade" }),
    friendlyName: text("friendly_name"),
    factorType: customType({ dataType: () => "auth.factor_type" })(
      "factor_type",
    ).notNull(),
    status: customType({ dataType: () => "auth.factor_status" })(
      "status",
    ).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    secret: text("secret"),
    phone: text("phone"),
    lastChallengedAt: timestamp("last_challenged_at", {
      withTimezone: true,
      mode: "string",
    }),
    webAuthnCredential: jsonb("web_authn_credential"),
    webAuthnAaguid: uuid("web_authn_aaguid"),
  },
  (table) => {
    return {
      mfaFactorsLastChallengedAtKey: unique(
        "mfa_factors_last_challenged_at_key",
      ).on(table.lastChallengedAt),
    };
  },
);

export const mfaChallengesInAuth = auth.table("mfa_challenges", {
  id: uuid("id").primaryKey().notNull(),
  factorId: uuid("factor_id")
    .notNull()
    .references(() => mfaFactorsInAuth.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),
  ipAddress: inet("ip_address").notNull(),
  otpCode: text("otp_code"),
  webAuthnSessionData: jsonb("web_authn_session_data"),
});

export const mfaAmrClaimsInAuth = auth.table(
  "mfa_amr_claims",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsInAuth.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    authenticationMethod: text("authentication_method").notNull(),
    id: uuid("id").primaryKey().notNull(),
  },
  (table) => {
    return {
      mfaAmrClaimsSessionIdAuthenticationMethodPkey: unique(
        "mfa_amr_claims_session_id_authentication_method_pkey",
      ).on(table.sessionId, table.authenticationMethod),
    };
  },
);

export const ssoProvidersInAuth = auth.table("sso_providers", {
  id: uuid("id").primaryKey().notNull(),
  resourceId: text("resource_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
});

export const ssoDomainsInAuth = auth.table("sso_domains", {
  id: uuid("id").primaryKey().notNull(),
  ssoProviderId: uuid("sso_provider_id")
    .notNull()
    .references(() => ssoProvidersInAuth.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
});

export const samlProvidersInAuth = auth.table(
  "saml_providers",
  {
    id: uuid("id").primaryKey().notNull(),
    ssoProviderId: uuid("sso_provider_id")
      .notNull()
      .references(() => ssoProvidersInAuth.id, { onDelete: "cascade" }),
    entityId: text("entity_id").notNull(),
    metadataXml: text("metadata_xml").notNull(),
    metadataUrl: text("metadata_url"),
    attributeMapping: jsonb("attribute_mapping"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    nameIdFormat: text("name_id_format"),
  },
  (table) => {
    return {
      samlProvidersEntityIdKey: unique("saml_providers_entity_id_key").on(
        table.entityId,
      ),
    };
  },
);

export const samlRelayStatesInAuth = auth.table("saml_relay_states", {
  id: uuid("id").primaryKey().notNull(),
  ssoProviderId: uuid("sso_provider_id")
    .notNull()
    .references(() => ssoProvidersInAuth.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  forEmail: text("for_email"),
  redirectTo: text("redirect_to"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  flowStateId: uuid("flow_state_id").references(() => flowStateInAuth.id, {
    onDelete: "cascade",
  }),
});

export const flowStateInAuth = auth.table("flow_state", {
  id: uuid("id").primaryKey().notNull(),
  userId: uuid("user_id"),
  authCode: text("auth_code").notNull(),
  codeChallengeMethod: customType({
    dataType: () => "auth.code_challenge_method",
  })("code_challenge_method").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  providerType: text("provider_type").notNull(),
  providerAccessToken: text("provider_access_token"),
  providerRefreshToken: text("provider_refresh_token"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  authenticationMethod: text("authentication_method").notNull(),
  authCodeIssuedAt: timestamp("auth_code_issued_at", {
    withTimezone: true,
    mode: "string",
  }),
});

export const oneTimeTokensInAuth = auth.table("one_time_tokens", {
  id: uuid("id").primaryKey().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersInAuth.id, { onDelete: "cascade" }),
  tokenType: customType({ dataType: () => "auth.one_time_token_type" })(
    "token_type",
  ).notNull(),
  tokenHash: text("token_hash").notNull(),
  relatesTo: text("relates_to").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const __drizzleMigrationsInDrizzle = drizzle.table(
  "__drizzle_migrations",
  {
    id: serial("id").primaryKey().notNull(),
    hash: text("hash").notNull(),
    createdAt: bigint("created_at", { mode: "number" }),
  },
);

export const keyInPgsodium = pgsodium.table(
  "key",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    status: customType({ dataType: () => "pgsodium.key_status" })("status"),
    created: timestamp("created", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "string" }),
    keyType: customType({ dataType: () => "pgsodium.key_type" })("key_type"),
    keyId: bigserial("key_id", { mode: "bigint" }),
    keyContext: customType({ dataType: () => "bytea" })("key_context"),
    name: text("name"),
    associatedData: text("associated_data").default(sql`'associated'`),
    rawKey: customType({ dataType: () => "bytea" })("raw_key"),
    rawKeyNonce: customType({ dataType: () => "bytea" })("raw_key_nonce"),
    parentKey: uuid("parent_key"),
    comment: text("comment"),
    userData: text("user_data"),
  },
  (table) => {
    return {
      keyParentKeyFkey: foreignKey({
        columns: [table.parentKey],
        foreignColumns: [table.id],
        name: "key_parent_key_fkey",
      }),
      pgsodiumKeyUniqueName: unique("pgsodium_key_unique_name").on(table.name),
    };
  },
);

export const documents = pgTable("documents", {
  id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
  content: text("content"),
  metadata: jsonb("metadata"),
  embedding: vector("embedding", { dimensions: 1536 }),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    email: text("email").notNull(),
    username: text("username"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    profileImageUrl: text("profile_image_url"),
  },
  (table) => {
    return {
      usersEmailUnique: unique("users_email_unique").on(table.email),
      usersUsernameUnique: unique("users_username_unique").on(table.username),
    };
  },
);

export const content = pgTable("content", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  status: contentStatus("status").default(sql`'draft'`),
});

export const metadata = pgTable("metadata", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  contentId: uuid("content_id").references(() => content.id, {
    onDelete: "cascade",
  }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
});

export const schemaMigrationsInRealtime = realtime.table("schema_migrations", {
  version: bigint("version", { mode: "number" }).primaryKey().notNull(),
  insertedAt: timestamp("inserted_at", { mode: "string" }),
});

export const subscriptionInRealtime = realtime.table("subscription", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .notNull()
    .generatedAlwaysAsIdentity({
      name: "null",
      startWith: undefined,
      increment: undefined,
      minValue: undefined,
      maxValue: undefined,
      cache: undefined,
    }),
  subscriptionId: uuid("subscription_id").notNull(),
  entity: customType({ dataType: () => "regclass" })("entity").notNull(),
  filters: customType({ dataType: () => "realtime.user_defined_filter[]" })(
    "filters",
  ).notNull(),
  claims: jsonb("claims").notNull(),
  claimsRole: customType({ dataType: () => "regrole" })("claims_role")
    .notNull()
    .generatedAlwaysAs(sql`realtime.to_regrole((claims ->> 'role'::text))`),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`timezone('utc'::text, now())`)
    .notNull(),
});

export const bucketsInStorage = storage.table("buckets", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  owner: uuid("owner"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  public: boolean("public").default(sql`false`),
  avifAutodetection: boolean("avif_autodetection").default(sql`false`),
  fileSizeLimit: bigint("file_size_limit", { mode: "number" }),
  allowedMimeTypes: text("allowed_mime_types"),
  ownerId: text("owner_id"),
});

export const objectsInStorage = storage.table("objects", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  bucketId: text("bucket_id").references(() => bucketsInStorage.id),
  name: text("name"),
  owner: uuid("owner"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  metadata: jsonb("metadata"),
  pathTokens: text("path_tokens")
    .default(sql`string_to_array(name, '/'::text)`)
    .generatedAlwaysAs(sql`string_to_array(name, '/'::text)`),
  version: text("version"),
  ownerId: text("owner_id"),
  userMetadata: jsonb("user_metadata"),
});

export const migrationsInStorage = storage.table(
  "migrations",
  {
    id: integer("id").primaryKey().notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    hash: varchar("hash", { length: 40 }).notNull(),
    executedAt: timestamp("executed_at", { mode: "string" }).defaultNow(),
  },
  (table) => {
    return {
      migrationsNameKey: unique("migrations_name_key").on(table.name),
    };
  },
);

export const s3MultipartUploadsInStorage = storage.table(
  "s3_multipart_uploads",
  {
    id: text("id").primaryKey().notNull(),
    inProgressSize: bigint("in_progress_size", { mode: "number" })
      .default(sql`0`)
      .notNull(),
    uploadSignature: text("upload_signature").notNull(),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => bucketsInStorage.id),
    key: text("key").notNull(),
    version: text("version").notNull(),
    ownerId: text("owner_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    userMetadata: jsonb("user_metadata"),
  },
);

export const s3MultipartUploadsPartsInStorage = storage.table(
  "s3_multipart_uploads_parts",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    uploadId: text("upload_id")
      .notNull()
      .references(() => s3MultipartUploadsInStorage.id, {
        onDelete: "cascade",
      }),
    size: bigint("size", { mode: "number" }).default(sql`0`).notNull(),
    partNumber: integer("part_number").notNull(),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => bucketsInStorage.id),
    key: text("key").notNull(),
    etag: text("etag").notNull(),
    ownerId: text("owner_id"),
    version: text("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
);

export const schemaMigrationsInSupabaseMigrations = supabaseMigrations.table(
  "schema_migrations",
  {
    version: text("version").primaryKey().notNull(),
    statements: text("statements"),
    name: text("name"),
  },
);

export const seedFilesInSupabaseMigrations = supabaseMigrations.table(
  "seed_files",
  {
    path: text("path").primaryKey().notNull(),
    hash: text("hash").notNull(),
  },
);

export const secretsInVault = vault.table("secrets", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name"),
  description: text("description").default(sql`''`).notNull(),
  secret: text("secret").notNull(),
  keyId: uuid("key_id")
    .default(sql`(pgsodium.create_key()).id`)
    .references(() => keyInPgsodium.id),
  nonce: customType({ dataType: () => "bytea" })("nonce"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
