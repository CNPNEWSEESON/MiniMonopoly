import blessed from "blessed";

// Dot patterns for each face of a die (5 rows × 11 cols).
// Widened from the original 5-col layout: a terminal character cell is
// roughly twice as tall as it is wide, so the dots need to be spread out
// horizontally for the bordered box to actually look square instead of a
// tall, narrow rectangle.
const DOT   = "{bold}{white-fg}●{/white-fg}{/bold}";
const BLANK = " ".repeat(11);
const LEFT_ONLY  = DOT + " ".repeat(10);
const RIGHT_ONLY = " ".repeat(10) + DOT;
const BOTH_ENDS  = DOT + " ".repeat(9) + DOT;
const CENTER     = " ".repeat(5) + DOT + " ".repeat(5);

const DICE_FACES: Record<number, string[]> = {
  1: [BLANK,      BLANK, CENTER, BLANK, BLANK],
  2: [LEFT_ONLY,  BLANK, BLANK,  BLANK, RIGHT_ONLY],
  3: [LEFT_ONLY,  BLANK, CENTER, BLANK, RIGHT_ONLY],
  4: [BOTH_ENDS,  BLANK, BLANK,  BLANK, BOTH_ENDS],
  5: [BOTH_ENDS,  BLANK, CENTER, BLANK, BOTH_ENDS],
  6: [BOTH_ENDS,  BLANK, BOTH_ENDS, BLANK, BOTH_ENDS],
};

export class DiceView {
  public readonly box = blessed.box({
    label: " Dices ",
    border: { type: "line" },
    style: {
      border: { fg: "cyan" },
      label: { fg: "white", bold: true },
    },
    tags: true,
    align: "center" as const,
    valign: "middle" as const,
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
  });

  private die = 0;

  public render(die: number): void {
    this.die = die;
    this.draw();
  }

  private draw(): void {
    if (this.die === 0) {
      this.box.setContent("\n{white-fg}Roll to see dice{/white-fg}");
      return;
    }

    const face = DICE_FACES[this.die] ?? DICE_FACES[1]!;
    const top    = "{cyan-fg}┌───────────┐{/cyan-fg}";
    const bottom = "{cyan-fg}└───────────┘{/cyan-fg}";

    const lines: string[] = [top];
    for (let r = 0; r < 5; r++) {
      lines.push(`{cyan-fg}│{/cyan-fg}${face[r]!}{cyan-fg}│{/cyan-fg}`);
    }
    lines.push(bottom);
    lines.push(`{bold}{yellow-fg}Rolled: ${this.die}{/yellow-fg}{/bold}`);

    this.box.setContent(lines.join("\n"));
  }
}