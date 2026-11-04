#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2233e92d4d91e4b62bdaa148e88652236270d6ca7f11d293bfa5efffb7eae60a/contract';
import startContract from '../../snapshots/2233e92d4d91e4b62bdaa148e88652236270d6ca7f11d293bfa5efffb7eae60a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5922401357cdcf861539d9441fc8139fc4e8dee3633eb8ec1eed2acacce86473/contract';
import endContract from '../../snapshots/5922401357cdcf861539d9441fc8139fc4e8dee3633eb8ec1eed2acacce86473/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'workspaces',
        constraint: 'workspaces_plan_check_fe6aa8d0',
      }),
      this.dropColumn({ schema: 'public', table: 'workspaces', column: 'plan' }),
      this.createTable({
        schema: 'public',
        table: 'kinde_webhook_deliveries',
        columns: [
          col('received_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('webhook_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['webhook_id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'usage_reports',
        columns: [
          col('cycle_end', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('cycle_start', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('feature', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kinde_agreement_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kinde_record_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reported_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('reported_total', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('workspace_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'workspaces',
        column: col('billing_changed_at', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'workspaces',
        column: col('kinde_billing_customer_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'workspaces',
        constraint: 'workspaces_kinde_billing_customer_id_key',
        columns: ['kinde_billing_customer_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage_reports',
        index: 'usage_reports_latest_ccf351e8',
        columns: ['workspace_id', 'kinde_agreement_id', 'cycle_start', 'reported_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usage_reports',
        index: 'usage_reports_workspace_id_idx_90a9f461',
        columns: ['workspace_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'usage_reports',
        foreignKey: {
          name: 'usage_reports_workspace_id_fkey',
          columns: ['workspace_id'],
          references: { schema: 'public', table: 'workspaces', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
