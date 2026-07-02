// @types/node が node:sqlite（Node 22.5+ 組み込み）を未収録のための最小型定義。
// @types/node を更新したらこのファイルは削除してよい。
declare module "node:sqlite" {
  type SQLValue = string | number | bigint | Uint8Array | null;

  interface StatementSync {
    all(...params: SQLValue[]): Record<string, unknown>[];
    get(...params: SQLValue[]): Record<string, unknown> | undefined;
    run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; open?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export { DatabaseSync, StatementSync };
}
