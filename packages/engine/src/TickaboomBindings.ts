import { Container } from "inversify";

import { BoardGeometry } from "./board/index.ts";
import { ExplosionResolver } from "./explosion/index.ts";
import { PlacementRules } from "./placement/index.ts";
import { PlayerIdFactory } from "./player/index.ts";
import { TickaboomEngine } from "./TickaboomEngine.ts";

export class TickaboomBindings {
  public apply(container: Container): void {
    container.bind(BoardGeometry).toSelf().inSingletonScope();
    container.bind(PlayerIdFactory).toSelf().inSingletonScope();
    container.bind(PlacementRules).toSelf().inSingletonScope();
    container.bind(ExplosionResolver).toSelf().inSingletonScope();
    container.bind(TickaboomEngine).toSelf().inSingletonScope();
  }
}
