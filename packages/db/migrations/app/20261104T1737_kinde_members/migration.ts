#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2233e92d4d91e4b62bdaa148e88652236270d6ca7f11d293bfa5efffb7eae60a/contract';
import endContract from '../../snapshots/2233e92d4d91e4b62bdaa148e88652236270d6ca7f11d293bfa5efffb7eae60a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b759717b02b8c792c5847b3548a557441861ec4a6ba83f65a527fd9c1ec8adc5/contract';
import startContract from '../../snapshots/b759717b02b8c792c5847b3548a557441861ec4a6ba83f65a527fd9c1ec8adc5/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'members',
        constraint: 'members_role_check_389fa750',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'members',
        constraint: 'members_user_id_key',
      }),
      this.dropColumn({ schema: 'public', table: 'members', column: 'user_id' }),
      this.createTable({
        schema: 'public',
        table: 'invitations',
        columns: [
          col('accepted_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('invited_by_member_id', 'uuid', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('workspace_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'invitations_role_check_578326ec',
            "\"role\" IN ('support', 'billing-admin')",
          ),
          checkExpression(
            'invitations_status_check_e437b281',
            "\"status\" IN ('pending', 'accepted', 'revoked')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'reply_suggestions',
        columns: [
          col('body', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('conversation_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('finished_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotency_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('latency_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('member_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tokens_in', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('tokens_out', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('workspace_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'reply_suggestions_status_check_ff8e7f67',
            "\"status\" IN ('pending', 'succeeded', 'failed')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'members',
        column: col('access_changed_at', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'workspaces',
        column: col('plan', 'text', {
          notNull: true,
          default: lit('free'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      // v2 starts from an empty database, so there is nothing to backfill.
      this.addColumn({
        schema: 'public',
        table: 'members',
        column: col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
      }),
      // v2 starts from an empty database, so there is nothing to backfill.
      this.addColumn({
        schema: 'public',
        table: 'members',
        column: col('kinde_user_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
      }),
      // v2 starts from an empty database, so there is nothing to backfill.
      this.addColumn({
        schema: 'public',
        table: 'workspaces',
        column: col('kinde_org_code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'members',
        constraint: 'members_role_check_e9e55bbe',
        expression: "\"role\" IN ('owner', 'support', 'billing-admin')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'members',
        constraint: 'members_kinde_user_id_key',
        columns: ['kinde_user_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'reply_suggestions',
        constraint: 'reply_suggestions_workspace_id_idempotency_key_key',
        columns: ['workspace_id', 'idempotency_key'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'workspaces',
        constraint: 'workspaces_plan_check_fe6aa8d0',
        expression: "\"plan\" IN ('free', 'pro')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'workspaces',
        constraint: 'workspaces_kinde_org_code_key',
        columns: ['kinde_org_code'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitations',
        index: 'invitations_invited_by_member_id_idx_d5c987a5',
        columns: ['invited_by_member_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitations',
        index: 'invitations_one_pending_per_email_5bb62447',
        columns: ['workspace_id', 'email'],
        extras: { where: "(status = 'pending')", unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitations',
        index: 'invitations_workspace_id_created_at_idx_3f0db799',
        columns: ['workspace_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'invitations',
        index: 'invitations_workspace_id_idx_90a9f461',
        columns: ['workspace_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reply_suggestions',
        index: 'reply_suggestions_conversation_id_idx_0c3639df',
        columns: ['conversation_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reply_suggestions',
        index: 'reply_suggestions_member_id_idx_10d5a0e2',
        columns: ['member_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reply_suggestions',
        index: 'reply_suggestions_workspace_id_idx_90a9f461',
        columns: ['workspace_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reply_suggestions',
        index: 'reply_suggestions_workspace_id_status_created_at_idx_2539eff4',
        columns: ['workspace_id', 'status', 'created_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'invitations',
        foreignKey: {
          name: 'invitations_workspace_id_fkey',
          columns: ['workspace_id'],
          references: { schema: 'public', table: 'workspaces', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'invitations',
        foreignKey: {
          name: 'invitations_invited_by_member_id_fkey',
          columns: ['invited_by_member_id'],
          references: { schema: 'public', table: 'members', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reply_suggestions',
        foreignKey: {
          name: 'reply_suggestions_workspace_id_fkey',
          columns: ['workspace_id'],
          references: { schema: 'public', table: 'workspaces', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reply_suggestions',
        foreignKey: {
          name: 'reply_suggestions_conversation_id_fkey',
          columns: ['conversation_id'],
          references: { schema: 'public', table: 'conversations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reply_suggestions',
        foreignKey: {
          name: 'reply_suggestions_member_id_fkey',
          columns: ['member_id'],
          references: { schema: 'public', table: 'members', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
