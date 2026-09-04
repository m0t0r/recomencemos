/**
 * Against a real `readline` interface over in-memory streams, because the thing
 * under test is what `readline` does when its input ends — a double would be
 * asserting the belief that produced the bug.
 */

import { PassThrough } from "node:stream";
import { createInterface, type Interface } from "node:readline/promises";
import { promptForCode } from "#admin/prompt";

function exchange(): { input: PassThrough; rl: Interface } {
  const input = new PassThrough();
  // `terminal: true` is what the command uses, and it is kept here rather than
  // simplified away: it changes how `readline` consumes its input, which is the
  // subject.
  const rl = createInterface({ input, output: new PassThrough(), terminal: true });
  return { input, rl };
}

describe("promptForCode", () => {
  it("reads a line and hands back what was typed", async () => {
    const { input, rl } = exchange();
    const answer = promptForCode(rl, "Code: ");
    input.write("123456\n");

    await expect(answer).resolves.toBe("123456");
    rl.close();
  });

  it("trims it, because a pasted code arrives with whatever was around it", async () => {
    const { input, rl } = exchange();
    const answer = promptForCode(rl, "Code: ");
    input.write("  123456  \n");

    await expect(answer).resolves.toBe("123456");
    rl.close();
  });

  /**
   * The defect this file exists for. Input ending *under* a pending question
   * neither rejects nor resolves on its own, so the command died on an unsettled
   * top-level await having printed nothing about why — and the comment above the
   * function claimed the opposite for as long as it was wrong.
   */
  it("gives up when the input ends while the question is waiting", async () => {
    const { input, rl } = exchange();
    const answer = promptForCode(rl, "Code: ");
    input.end();

    await expect(answer).resolves.toBeUndefined();
  });

  it("gives up when the input had already ended before it asked", async () => {
    const { input, rl } = exchange();
    input.end();
    await new Promise((resolve) => rl.once("close", resolve));

    await expect(promptForCode(rl, "Code: ")).resolves.toBeUndefined();
  });

  /**
   * Three attempts run against one interface, so a listener left behind per call
   * accumulates. It is bounded and would warn rather than break, which is
   * exactly the kind of thing nobody notices.
   */
  it("leaves no listener behind, however the question ended", async () => {
    const { input, rl } = exchange();
    // Against what the interface arrived with rather than against zero:
    // `readline` keeps one `close` listener of its own from construction, and an
    // assertion of zero would be pinning that rather than this.
    const before = rl.listenerCount("close");

    const answered = promptForCode(rl, "Code: ");
    expect(rl.listenerCount("close")).toBe(before + 1);
    input.write("111111\n");
    await answered;
    expect(rl.listenerCount("close")).toBe(before);

    // The abandoned case is asserted as "no more than before" rather than as an
    // equality, because closing is what ended it and `readline` drops its own
    // listener at the same moment — an equality here would go red on the day
    // that internal detail changed, which is not what this pins.
    const abandoned = promptForCode(rl, "Code: ");
    expect(rl.listenerCount("close")).toBe(before + 1);
    input.end();
    await abandoned;
    expect(rl.listenerCount("close")).toBeLessThanOrEqual(before);
  });
});
