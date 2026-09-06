import type { Game } from "../game/Game";
import { Player } from "../game/Player";

export class EasyAI {
  constructor(public readonly player: Player) {
    player.sellPriority = (p) => [...p.properties].sort((a, b) => a.price - b.price);
    player.decideJail = () => false;
  }
 
  public takeTurn(game: Game): void {
    const dice = game.roll(this.player);
    if (dice === 0) return;
    const tile = game.board.getTile(this.player.position);
    if (tile.type === "property" && tile.property && !tile.property.owner) {
      if (this.player.money >= tile.property.price) game.buy(this.player);
    }
  }
}
 