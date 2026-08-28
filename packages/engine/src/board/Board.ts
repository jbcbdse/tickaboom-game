import type { Cell } from "./Cell.ts";
import type { BoardGeometry } from "./BoardGeometry.ts";

export class Board {
  private constructor(
    private readonly geometry: BoardGeometry,
    private readonly cells: Cell[],
  ) {}

  public static fromCells(geometry: BoardGeometry, cells: Cell[][]): Board {
    const board = Board.empty(geometry);
    for (let y = 0; y < geometry.size; y += 1) {
      for (let x = 0; x < geometry.size; x += 1) {
        const row = cells[y];
        const cell = row?.[x];
        if (!cell) {
          throw new Error(`Missing cell ${String(x)},${String(y)}`);
        }
        board.set(x, y, { owner: cell.owner, pips: cell.pips });
      }
    }
    return board;
  }

  public static empty(geometry: BoardGeometry): Board {
    const cells: Cell[] = [];
    const total = geometry.size * geometry.size;
    for (let i = 0; i < total; i += 1) {
      cells.push({ owner: null, pips: 0 });
    }
    return new Board(geometry, cells);
  }

  public clone(): Board {
    return new Board(
      this.geometry,
      this.cells.map((cell) => ({ owner: cell.owner, pips: cell.pips })),
    );
  }

  public get(x: number, y: number): Cell {
    const cell = this.cells[this.index(x, y)];
    if (!cell) {
      throw new Error(`No cell at ${String(x)},${String(y)}`);
    }
    return cell;
  }

  public set(x: number, y: number, cell: Cell): void {
    this.cells[this.index(x, y)] = cell;
  }

  public toCells(): Cell[][] {
    const grid: Cell[][] = [];
    for (let y = 0; y < this.geometry.size; y += 1) {
      const row: Cell[] = [];
      for (let x = 0; x < this.geometry.size; x += 1) {
        row.push(this.get(x, y));
      }
      grid.push(row);
    }
    return grid;
  }

  public occupiedCount(owner: Cell["owner"]): number {
    let count = 0;
    for (const cell of this.cells) {
      if (cell.owner === owner && cell.pips > 0) {
        count += 1;
      }
    }
    return count;
  }

  public pipCount(owner: Cell["owner"]): number {
    let count = 0;
    for (const cell of this.cells) {
      if (cell.owner === owner) {
        count += cell.pips;
      }
    }
    return count;
  }

  private index(x: number, y: number): number {
    if (!this.geometry.inBounds(x, y)) {
      throw new Error(`Out of bounds ${String(x)},${String(y)}`);
    }
    return y * this.geometry.size + x;
  }
}
