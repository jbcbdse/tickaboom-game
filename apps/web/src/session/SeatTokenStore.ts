export class SeatTokenStore {
  public get(joinCode: string): string | undefined {
    return sessionStorage.getItem(this.key(joinCode)) ?? undefined;
  }

  public set(joinCode: string, token: string): void {
    sessionStorage.setItem(this.key(joinCode), token);
  }

  public clear(joinCode: string): void {
    sessionStorage.removeItem(this.key(joinCode));
  }

  private key(joinCode: string): string {
    return `tickaboom.seat.${joinCode}`;
  }
}
