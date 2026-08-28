import { Container } from "inversify";
import { TickaboomBindings, TickaboomEngine } from "@tickaboom/engine";

import { GameAudio } from "../audio";
import { PlayerColors } from "../view";

export class AppContainer {
  public readonly container: Container;
  public readonly engine: TickaboomEngine;
  public readonly colors: PlayerColors;
  public readonly audio: GameAudio;

  public constructor() {
    this.container = new Container();
    new TickaboomBindings().apply(this.container);
    this.container.bind(PlayerColors).toSelf().inSingletonScope();
    this.container.bind(GameAudio).toSelf().inSingletonScope();
    this.engine = this.container.get(TickaboomEngine);
    this.colors = this.container.get(PlayerColors);
    this.audio = this.container.get(GameAudio);
  }
}
