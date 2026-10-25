export class JsonRecord {
  public parse(raw: string): Record<string, unknown> | null {
    try {
      const data: unknown = JSON.parse(raw);
      return this.is(data) ? data : null;
    } catch {
      return null;
    }
  }

  public is(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
