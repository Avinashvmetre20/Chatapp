import { PoolClient, QueryResult, QueryResultRow } from 'pg';

export type SqlQuery = <T extends QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<QueryResult<T>>;

export type SqlClient = {
  query: SqlQuery;
};
