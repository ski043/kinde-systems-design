#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/388637fb89cf00c77555a5f14246aa29e71d08742a49bfd414169019285eeab8/contract';
import startContract from '../../snapshots/388637fb89cf00c77555a5f14246aa29e71d08742a49bfd414169019285eeab8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7904bab7874dafef270fcace11827f3353473954f0c751a1c378f8162fb2ee47/contract';
import endContract from '../../snapshots/7904bab7874dafef270fcace11827f3353473954f0c751a1c378f8162fb2ee47/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'invitations',
        constraint: 'invitations_role_check_578326ec',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'members',
        constraint: 'members_role_check_e9e55bbe',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'invitations',
        constraint: 'invitations_role_check_c8de8f61',
        expression: '"role" IN (\'support\')',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'members',
        constraint: 'members_role_check_23d96db6',
        expression: "\"role\" IN ('owner', 'support')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
