import { DatabaseError, NotFoundError, UnauthorizedError, ValidationError } from "../contracts/errors";

export interface SupabaseClientConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface PostgrestQueryParams {
  [key: string]: string | number | boolean | undefined;
}

export class SupabaseClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: SupabaseClientConfig = {}) {
    this.baseUrl = (config.supabaseUrl || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
    this.apiKey =
      config.supabaseKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "";
    this.fetchFn = config.fetchFn || globalThis.fetch;
    this.timeoutMs = config.timeoutMs || 15000;
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    };
  }

  private buildUrl(path: string, queryParams?: PostgrestQueryParams): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (queryParams) {
      for (const [key, val] of Object.entries(queryParams)) {
        if (val !== undefined) {
          url.searchParams.append(key, String(val));
        }
      }
    }
    return url.toString();
  }

  private handleError(status: number, errorData: unknown, context: string): never {
    const message =
      typeof errorData === "object" && errorData && "message" in errorData
        ? String((errorData as { message: unknown }).message)
        : `Database operation failed with HTTP status ${status}`;

    if (status === 401 || status === 403 || message.toLowerCase().includes("unauthorized")) {
      throw new UnauthorizedError(`Supabase unauthorized: ${message}`, { status, context });
    }
    if (status === 404 || message.toLowerCase().includes("not found")) {
      throw new NotFoundError(`Record not found: ${message}`, { status, context });
    }
    if (
      status === 400 ||
      status === 409 ||
      status === 422 ||
      message.toLowerCase().includes("violates") ||
      message.toLowerCase().includes("already been approved") ||
      message.toLowerCase().includes("marked rejected")
    ) {
      throw new ValidationError(message, { status, context });
    }
    throw new DatabaseError(`Database error during ${context}: ${message}`, { status, errorData });
  }

  /**
   * PostgREST SELECT query
   */
  public async select<T>(table: string, queryParams?: PostgrestQueryParams): Promise<T[]> {
    if (!this.isConfigured()) {
      throw new DatabaseError("Supabase client is not configured (missing SUPABASE_URL or SUPABASE_KEY).");
    }

    const url = this.buildUrl(`/rest/v1/${table}`, queryParams);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.handleError(response.status, errorData, `SELECT from ${table}`);
      }

      return (await response.json()) as T[];
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError || err instanceof NotFoundError || err instanceof ValidationError || err instanceof DatabaseError) {
        throw err;
      }
      throw new DatabaseError(`Failed to fetch from ${table}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * PostgREST SELECT single row
   */
  public async selectOne<T>(table: string, queryParams?: PostgrestQueryParams): Promise<T | null> {
    const rows = await this.select<T>(table, { ...queryParams, limit: 1 });
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * PostgREST INSERT query
   */
  public async insert<T>(table: string, payload: Record<string, unknown> | Array<Record<string, unknown>>): Promise<T> {
    if (!this.isConfigured()) {
      throw new DatabaseError("Supabase client is not configured (missing SUPABASE_URL or SUPABASE_KEY).");
    }

    const url = this.buildUrl(`/rest/v1/${table}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: this.getHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.handleError(response.status, errorData, `INSERT into ${table}`);
      }

      const result = await response.json();
      return (Array.isArray(result) ? result[0] : result) as T;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError || err instanceof NotFoundError || err instanceof ValidationError || err instanceof DatabaseError) {
        throw err;
      }
      throw new DatabaseError(`Failed to insert into ${table}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * PostgREST UPDATE query
   */
  public async update<T>(table: string, queryParams: PostgrestQueryParams, updates: Record<string, unknown>): Promise<T[]> {
    if (!this.isConfigured()) {
      throw new DatabaseError("Supabase client is not configured (missing SUPABASE_URL or SUPABASE_KEY).");
    }

    const url = this.buildUrl(`/rest/v1/${table}`, queryParams);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "PATCH",
        headers: this.getHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify(updates),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.handleError(response.status, errorData, `UPDATE ${table}`);
      }

      return (await response.json()) as T[];
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError || err instanceof NotFoundError || err instanceof ValidationError || err instanceof DatabaseError) {
        throw err;
      }
      throw new DatabaseError(`Failed to update ${table}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * PostgREST DELETE query
   */
  public async delete<T>(table: string, queryParams: PostgrestQueryParams): Promise<T[]> {
    if (!this.isConfigured()) {
      throw new DatabaseError("Supabase client is not configured (missing SUPABASE_URL or SUPABASE_KEY).");
    }

    const url = this.buildUrl(`/rest/v1/${table}`, queryParams);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "DELETE",
        headers: this.getHeaders({ Prefer: "return=representation" }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.handleError(response.status, errorData, `DELETE from ${table}`);
      }

      return (await response.json()) as T[];
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError || err instanceof NotFoundError || err instanceof ValidationError || err instanceof DatabaseError) {
        throw err;
      }
      throw new DatabaseError(`Failed to delete from ${table}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Supabase RPC call for atomic database transactions
   */
  public async rpc<T>(functionName: string, params: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured()) {
      throw new DatabaseError("Supabase client is not configured (missing SUPABASE_URL or SUPABASE_KEY).");
    }

    const url = this.buildUrl(`/rest/v1/rpc/${functionName}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.handleError(response.status, errorData, `RPC ${functionName}`);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError || err instanceof NotFoundError || err instanceof ValidationError || err instanceof DatabaseError) {
        throw err;
      }
      throw new DatabaseError(`Failed to execute RPC ${functionName}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
