/**
 * test/helpers/supabase.mock.ts
 *
 * Fábrica centralizada de mock para el cliente Supabase.
 * Crea un objeto que imita la API fluida de Supabase (from → select → eq → single, etc.)
 * y es "thenable" para soportar await directo (sin llamar .single()).
 */

export interface MockSupabaseChain {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  or: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  then: (resolve: Function, reject?: Function) => Promise<any>;
  /** Helper para cambiar el resultado del `then` (await directo) */
  _setThenResult: (data: any, error?: any, count?: number) => void;
  /** Helper para cambiar el resultado de `.single()` */
  _setSingleResult: (data: any, error?: any) => void;
}

export function createMockSupabaseClient(): MockSupabaseChain {
  let thenResult = { data: null as any, error: null as any, count: 0 };

  const chain: MockSupabaseChain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),

    // thenable: permite `const { data } = await supabase.from().select().eq()`
    then: function (resolve: Function, reject?: Function) {
      return Promise.resolve(thenResult).then(resolve as any, reject as any);
    },

    _setThenResult(data: any, error: any = null, count = 0) {
      thenResult = { data, error, count };
    },

    _setSingleResult(data: any, error: any = null) {
      chain.single.mockResolvedValue({ data, error });
    },
  };

  return chain;
}
