import { NextRequest, NextResponse } from "next/server";
import { runCommand } from "@/lib/game/store";
import type { Command } from "@/lib/game/types";
import { buildView } from "@/lib/game/view";

export const runtime = "nodejs";

const commandTypes = new Set<Command["type"]>([
  "quest.start",
  "quest.progress",
  "quest.complete",
  "item.consume",
  "item.equip",
  "item.unequip",
  "grants.accept",
  "encounter.complete",
]);

// Runs one command through the engine. A rejection is a 409 with the
// reason and what's missing; the fresh view comes back either way so the
// client can resync.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const command = body?.command as Command | undefined;
  if (
    !command ||
    typeof command !== "object" ||
    !commandTypes.has(command.type)
  ) {
    return NextResponse.json(
      { error: "A valid command is required" },
      { status: 400 },
    );
  }

  try {
    const outcome = await runCommand(command);
    if (!outcome.ok) {
      return NextResponse.json(
        { rejection: outcome.rejection, view: buildView(outcome.save) },
        { status: 409 },
      );
    }
    return NextResponse.json({
      applied: outcome.applied,
      view: buildView(outcome.save),
    });
  } catch (error) {
    console.error("Failed to run command", command.type, error);
    return NextResponse.json(
      { error: "Failed to run command" },
      { status: 500 },
    );
  }
}
