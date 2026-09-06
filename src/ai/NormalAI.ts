import { JAIL_BAIL_AMOUNT, type Game } from "../game/Game";
import { Player } from "../game/Player";

const MIN_CASH_BUFFER_AFTER_BUY = 350;
const GOOD_RENT_THRESHOLD = 50;
const MAX_PROPERTIES = 4;
const MIN_CASH_BUFFER_AFTER_BAIL = 300;

export class NormalAI {
  constructor(public readonly player: Player) {
    player.sellPriority = (p) => [...p.properties].sort((a, b) => a.rent - b.rent);
    player.decideJail = (_game, p) => p.money - JAIL_BAIL_AMOUNT >= MIN_CASH_BUFFER_AFTER_BAIL;
  }

  public takeTurn(game: Game): void {
    const dice = game.roll(this.player);
    if (dice === 0) return;
    const tile = game.board.getTile(this.player.position);
    if (tile.type !== "property" || !tile.property || tile.property.owner) return;

    const p = tile.property;
    const affordableBuffer = this.player.money - p.price >= MIN_CASH_BUFFER_AFTER_BUY;
    const goodRent = p.rent >= GOOD_RENT_THRESHOLD;
    const notOverextended = this.player.properties.length < MAX_PROPERTIES;

    if (affordableBuffer && goodRent && notOverextended) game.buy(this.player);
  }
}