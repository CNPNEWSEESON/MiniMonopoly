import blessed from "blessed";
import { execSync } from "child_process";
import { Game } from "../game/Game";
import { Player } from "../game/Player";
import { EasyAI } from "../ai/EasyAI";
import { NormalAI } from "../ai/NormalAI";
import { HardAI } from "../ai/HardAI";
import { BoardView } from "./BoardView";
import { PlayerView } from "./PlayerView";
import { GameLog } from "./GameLog";
import { ActionMenu } from "./ActionMenu";
import { DiceView } from "./DiceView";
import { Property } from "../game/Property";

type Mode = "easy" | "normal" | "hard";

declare namespace Bun {
  function write(path: string, data: string): Promise<number>;
}

export class App {
  private readonly screen: blessed.Widgets.Screen;
  private readonly boardView: BoardView;
  private readonly playerView: PlayerView;
  private readonly gameLog: GameLog;
  private readonly actionMenu: ActionMenu;
  private readonly diceView: DiceView;
  private game!: Game;
  private ais!: (EasyAI | NormalAI | HardAI)[];
  private busy = false;

  constructor() {
    App.resizeConsole(158, 46);
    this.screen = blessed.screen({ smartCSR: true, title: "Mini Monopoly TUI" });
    this.boardView = new BoardView();
    this.playerView = new PlayerView();
    this.gameLog = new GameLog();
    this.actionMenu = new ActionMenu();
    this.diceView = new DiceView();

    this.showModeSelect();
  }

  private static resizeConsole(cols: number, rows: number): void {
    try {
      if (process.platform === "win32") {
        execSync(`mode con: cols=${cols} lines=${rows}`);
      } else {
        process.stdout.write(`\x1b[8;${rows};${cols}t`);
      }
    } catch {

    }
  }

  public run(): void { this.screen.render(); }

  private showModeSelect(): void {
    const box = blessed.box({
      top: "center",
      left: "center",
      width: 54,
      height: 13,
      border: { type: "line" },
      label: " Select Difficulty ",
      tags: true,
      align: "left" as const,
      valign: "middle" as const,
      padding: { left: 3, right: 2, top: 0, bottom: 0 },
      style: { border: { fg: "cyan" }, label: { fg: "cyan", bold: true } },
      content: [
        "{bold}{white-fg}Mini Monopoly{/white-fg}{/bold}",
        "",
        "{green-fg}{bold}1{/bold}  Easy{/green-fg}     {white-fg}Bots buy when they can{/white-fg}",
        "{yellow-fg}{bold}2{/bold}  Normal{/yellow-fg}   {white-fg}Bots check cost and rent{/white-fg}",
        "{red-fg}{bold}3{/bold}  Hard{/red-fg}     {white-fg}Bots play carefully{/white-fg}",
        "",
        "{white-fg}You vs 3 bots at the chosen difficulty{/white-fg}",
      ].join("\n"),
    });

    this.screen.append(box);
    this.screen.render();

    const choose = (mode: Mode) => {
      this.screen.remove(box);
      this.startGame(mode);
    };

    this.screen.onceKey("1", () => choose("easy"));
    this.screen.onceKey("2", () => choose("normal"));
    this.screen.onceKey("3", () => choose("hard"));
    this.screen.key(["q", "C-c", "escape"], () => process.exit(0));
  }

  private startGame(mode: Mode): void {
    const kind = mode === "easy" ? "AI Easy" as const : mode === "normal" ? "AI Normal" as const : "AI Hard" as const;
    const AIClass = mode === "easy" ? EasyAI : mode === "normal" ? NormalAI : HardAI;

    const players = [
      new Player("human", "Player", "Human"),
      new Player("bot1", "Bot 1", kind),
      new Player("bot2", "Bot 2", kind),
      new Player("bot3", "Bot 3", kind),
    ];

    this.game = new Game(players, message => this.gameLog.add(message));
    this.ais = [new AIClass(players[1]!), new AIClass(players[2]!), new AIClass(players[3]!)];

    this.layout();
    this.bindKeys();
    this.render();
    this.screen.render();
  }

  private layout(): void {
    // ─── Left: Board (large, 72% wide, 85% tall) ───────────────────────────
    this.boardView.box.top    = 0;
    this.boardView.box.left   = 0;
    this.boardView.box.width  = "72%";
    this.boardView.box.height = "92%";

    // ─── Top-Right: Players (upper portion of right panel) ─────────────────
    this.playerView.box.top    = 0;
    this.playerView.box.left   = "72%";
    this.playerView.box.width  = "28%";
    this.playerView.box.height = "30%";

    // ─── Mid-Right: Game Log ────────────────────────────────────────────────
    this.gameLog.box.top    = "30%";
    this.gameLog.box.left   = "72%";
    this.gameLog.box.width  = "28%";
    this.gameLog.box.height = "30%";

    // ─── Bottom-Right: Dice View ─────────────────────────────────────────────
    this.diceView.box.top    = "60%";
    this.diceView.box.left   = "72%";
    this.diceView.box.width  = "28%";
    this.diceView.box.height = "40%";

    // ─── Bottom Full-Width: Action Bar ──────────────────────────────────────
    this.actionMenu.box.top    = "92%";
    this.actionMenu.box.left   = 0;
    this.actionMenu.box.width  = "72%";
    this.actionMenu.box.height = "8%";

    this.screen.append(this.boardView.box);
    this.screen.append(this.playerView.box);
    this.screen.append(this.gameLog.box);
    this.screen.append(this.diceView.box);
    this.screen.append(this.actionMenu.box);
  }

  private bindKeys(): void {
    this.screen.key(["q", "C-c", "escape"], () => process.exit(0));
    this.screen.key(["enter", "r"], () => { void this.handleRoll(); });
    this.screen.key(["b"], () => {
      if (!this.busy && this.game.currentPlayer.id === "human" && this.game.status === "playing") {
        this.game.buy(this.game.currentPlayer);
        this.render();
      }
    });
    this.screen.key(["s"], () => {
      if (!this.busy && this.game.currentPlayer.id === "human" && this.game.status === "playing") {
        this.sellCheapest();
      }
    });
    this.screen.key(["n"], () => {
      if (this.busy) return;
      process.exit(0);
    });
  }

  private async handleRoll(): Promise<void> {
    if (this.busy || this.game.status === "finished") return;
    if (this.game.currentPlayer.id !== "human") return;

    this.busy = true;

    const dice = this.game.roll();
    this.diceView.render(dice || 1);
    this.render();

    await Bun.write("save.json", JSON.stringify(this.serialize(), null, 2)).catch(() => {});

    if (this.game.pendingDebt) {
      await this.showDebtPrompt();
    }

    if (this.game.pendingProperty) {
      await this.showPurchasePrompt(this.game.pendingProperty);
    }

    while (this.game.status === "playing" && this.game.currentPlayer.id !== "human") {
      const currentAi = this.ais.find(ai => ai.player.id === this.game.currentPlayer.id);
      if (!currentAi || currentAi.player.status === "bankrupt") {
        this.game.nextTurn();
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 600));
      const aiDice = currentAi.takeTurn(this.game);
      if (typeof aiDice === "number" && aiDice > 0) this.diceView.render(aiDice);
      this.render();
    }

    this.busy = false;
  }

  private showDebtPrompt(): Promise<void> {
    return new Promise(resolve => {
      const list = blessed.list({
        top: "center",
        left: "center",
        width: "50%",
        height: "50%",
        border: { type: "line" },
        label: " 💸 Not Enough Cash ",
        tags: true,
        keys: true,
        mouse: true,
        style: {
          border: { fg: "red" },
          label: { fg: "red", bold: true },
          selected: { bg: "red", fg: "white", bold: true },
        } as any,
      });

      const refresh = () => {
        const p = this.game.currentPlayer;
        const owed = Math.max(0, -p.money);
        list.setLabel(` 💸 You owe $${owed} — sell a property `);
        const items = p.properties.map(prop =>
          `${prop.name}  —  sell for $${Math.floor(prop.price * 0.5)}`
        );
        items.push("{red-fg}{bold}[ Declare Bankruptcy ]{/bold}{/red-fg}");
        list.setItems(items as any);
        this.screen.render();
      };

      this.screen.append(list);
      refresh();
      list.focus();
      this.screen.render();

      list.on("select", (_item: unknown, index: number) => {
        const p = this.game.currentPlayer;
        if (index >= p.properties.length) {
          this.game.declareBankruptcy();
        } else {
          const prop = p.properties[index]!;
          this.game.sellForDebt(prop.id);
        }
        this.render();

        if (this.game.pendingDebt) {
          refresh();
        } else {
          this.screen.remove(list);
          this.screen.render();
          resolve();
        }
      });
    });
  }

  private showPurchasePrompt(property: Property): Promise<void> {
    return new Promise(resolve => {
      const box = blessed.box({
        top: "center",
        left: "center",
        width: "40%",
        height: "30%",
        border: { type: "line" },
        label: " Buy Property? ",
        tags: true,
        align: "center" as const,
        valign: "middle" as const,
        style: { border: { fg: "yellow" }, label: { fg: "yellow", bold: true } },
        content: [
          `{bold}Property: ${property.name}{/bold}`,
          `Price: $${property.price}`,
          `Rent: $${property.rent}`,
          "",
          "{green-fg}{bold}[B]{/bold}{/green-fg} Buy    {red-fg}{bold}[N]{/bold}{/red-fg} Skip",
        ].join("\n"),
      });
      this.screen.append(box);
      this.screen.render();

      const finish = (buy: boolean) => {
        this.game.decidePurchase(buy);
        this.screen.remove(box);
        this.render();
        this.screen.render();
        resolve();
      };

      this.screen.onceKey("b", () => finish(true));
      this.screen.onceKey("n", () => finish(false));
    });
  }

  private sellCheapest(): void {
    const p = this.game.currentPlayer;
    if (p.properties.length === 0) return;
    const cheapest = [...p.properties].sort((a, b) => a.price - b.price)[0]!;
    this.game.sellProperty(p, cheapest.id);
    this.render();
  }

  private render(): void {
    this.boardView.render(this.game.board, this.game.players);
    this.playerView.render(this.game.players, this.game.currentPlayer.id);
    this.screen.render();
  }

  private serialize() {
    return {
      currentPlayer: this.game.currentPlayer.id,
      players: this.game.players.map(p => ({
        id: p.id, name: p.name, kind: p.kind, money: p.money,
        position: p.position, status: p.status, properties: p.properties.map(x => x.id),
      })),
      savedAt: new Date().toISOString(),
    };
  }
}