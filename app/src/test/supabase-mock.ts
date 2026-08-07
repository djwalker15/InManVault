import { vi, type Mock } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useSupabase } from '@/lib/supabase'

interface QueryResult {
  data?: unknown
  error: Error | { message: string } | null
  count?: number | null
}

type Op =
  | 'upsert'
  | 'insert'
  | 'select'
  | 'update'
  | 'delete'
  | 'single'
  | 'maybeSingle'

type TableConfig = Partial<Record<Op, QueryResult | Promise<QueryResult>>>
type SupabaseConfig = Record<string, TableConfig>

type RpcResult = { data?: unknown; error: Error | null }
type RpcResultMap = Record<string, RpcResult>

export interface TableMock {
  upsert: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  ilike: ReturnType<typeof vi.fn>
  like: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  match: ReturnType<typeof vi.fn>
  contains: ReturnType<typeof vi.fn>
  containedBy: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

export interface StorageBucketMock {
  upload: ReturnType<typeof vi.fn>
  createSignedUrl: ReturnType<typeof vi.fn>
  createSignedUrls: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

export interface SupabaseMock {
  client: SupabaseClient
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  tables: Record<string, TableMock>
  storage: {
    from: Mock<(bucket: string) => StorageBucketMock>
    buckets: Record<string, StorageBucketMock>
  }
}

const DEFAULT_RESPONSE: QueryResult = { data: null, error: null }

function makeBuilder(config: TableConfig): TableMock & PromiseLike<QueryResult> {
  let response: QueryResult | Promise<QueryResult> = DEFAULT_RESPONSE

  const setIf = (op: Op) => {
    const v = config[op]
    if (v !== undefined) response = v
  }

  const builder = {
    upsert: vi.fn(() => {
      setIf('upsert')
      return builder
    }),
    insert: vi.fn(() => {
      setIf('insert')
      return builder
    }),
    select: vi.fn(() => {
      setIf('select')
      return builder
    }),
    update: vi.fn(() => {
      setIf('update')
      return builder
    }),
    delete: vi.fn(() => {
      setIf('delete')
      return builder
    }),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    not: vi.fn(() => builder),
    in: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    like: vi.fn(() => builder),
    or: vi.fn(() => builder),
    match: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    containedBy: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() => {
      setIf('single')
      return builder
    }),
    maybeSingle: vi.fn(() => {
      setIf('maybeSingle')
      return builder
    }),
    then: <TResolve = QueryResult, TReject = never>(
      onFulfilled?:
        | ((value: QueryResult) => TResolve | PromiseLike<TResolve>)
        | null,
      onRejected?:
        | ((reason: unknown) => TReject | PromiseLike<TReject>)
        | null,
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
  }

  return builder as TableMock & PromiseLike<QueryResult>
}

// Default-success storage bucket: upload echoes the path, signed URLs
// resolve to a deterministic fake host. Tests override behavior through
// the exposed vi.fn's (e.g. `.mockResolvedValueOnce({...})`).
function makeStorageBucket(): StorageBucketMock {
  return {
    upload: vi.fn((path: string) =>
      Promise.resolve({ data: { path }, error: null }),
    ),
    createSignedUrl: vi.fn((path: string) =>
      Promise.resolve({
        data: { signedUrl: `https://signed.test/${path}` },
        error: null,
      }),
    ),
    createSignedUrls: vi.fn((paths: string[]) =>
      Promise.resolve({
        data: paths.map((path) => ({
          error: null,
          path,
          signedUrl: `https://signed.test/${path}`,
        })),
        error: null,
      }),
    ),
    remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
  }
}

export function makeSupabaseMock(
  config: SupabaseConfig = {},
  rpcs: RpcResultMap = {},
): SupabaseMock {
  const tables: Record<string, TableMock> = {}

  for (const table of Object.keys(config)) {
    tables[table] = makeBuilder(config[table] ?? {}) as unknown as TableMock
  }

  const from = vi.fn((table: string) => {
    if (!tables[table]) {
      tables[table] = makeBuilder(config[table] ?? {}) as unknown as TableMock
    }
    return tables[table]
  })

  const rpc = vi.fn((name: string) => {
    const result: RpcResult = rpcs[name] ?? { data: null, error: null }
    return Promise.resolve(result)
  })

  const buckets: Record<string, StorageBucketMock> = {}
  const storageFrom = vi.fn((bucket: string) => {
    buckets[bucket] ??= makeStorageBucket()
    return buckets[bucket]
  })

  const client = {
    from,
    rpc,
    storage: { from: storageFrom },
  } as unknown as SupabaseClient

  vi.mocked(useSupabase).mockReturnValue(client)

  return { client, from, rpc, tables, storage: { from: storageFrom, buckets } }
}
