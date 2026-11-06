#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/388637fb89cf00c77555a5f14246aa29e71d08742a49bfd414169019285eeab8/contract';
import endContract from '../../snapshots/388637fb89cf00c77555a5f14246aa29e71d08742a49bfd414169019285eeab8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5922401357cdcf861539d9441fc8139fc4e8dee3633eb8ec1eed2acacce86473/contract';
import startContract from '../../snapshots/5922401357cdcf861539d9441fc8139fc4e8dee3633eb8ec1eed2acacce86473/contract.json' with { type: 'json' };
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
        table: 'agent_turns',
        constraint: 'agent_turns_handoff_reason_check_ae20b9e1',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'conversations',
        constraint: 'conversations_handoff_reason_check_ae20b9e1',
      }),
      this.dropTable({ schema: 'public', table: 'reply_suggestions' }),
      this.createTable({
        schema: 'public',
        table: 'ai_replies',
        columns: [
          col('conversation_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('finished_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('latency_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('message_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
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
            'ai_replies_status_check_ff8e7f67',
            "\"status\" IN ('pending', 'succeeded', 'failed')",
          ),
        ],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'agent_turns',
        constraint: 'agent_turns_handoff_reason_check_461dd71a',
        expression:
          "\"handoff_reason\" IN ('low_confidence', 'no_relevant_knowledge', 'visitor_requested', 'agent_off', 'ai_reply_limit')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'ai_replies',
        constraint: 'ai_replies_workspace_id_message_id_key',
        columns: ['workspace_id', 'message_id'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'conversations',
        constraint: 'conversations_handoff_reason_check_461dd71a',
        expression:
          "\"handoff_reason\" IN ('low_confidence', 'no_relevant_knowledge', 'visitor_requested', 'agent_off', 'ai_reply_limit')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'ai_replies',
        index: 'ai_replies_conversation_id_idx_0c3639df',
        columns: ['conversation_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ai_replies',
        index: 'ai_replies_message_id_idx_8a7ff1ba',
        columns: ['message_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ai_replies',
        index: 'ai_replies_workspace_id_idx_90a9f461',
        columns: ['workspace_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ai_replies',
        index: 'ai_replies_workspace_id_status_finished_at_idx_73239375',
        columns: ['workspace_id', 'status', 'finished_at'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ai_replies',
        foreignKey: {
          name: 'ai_replies_workspace_id_fkey',
          columns: ['workspace_id'],
          references: { schema: 'public', table: 'workspaces', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ai_replies',
        foreignKey: {
          name: 'ai_replies_conversation_id_fkey',
          columns: ['conversation_id'],
          references: { schema: 'public', table: 'conversations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ai_replies',
        foreignKey: {
          name: 'ai_replies_message_id_fkey',
          columns: ['message_id'],
          references: { schema: 'public', table: 'messages', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
