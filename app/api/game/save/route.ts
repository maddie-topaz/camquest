import { NextResponse } from "next/server";
import { ensurePlayer } from "@/lib/game/store";
import { buildView } from "@/lib/game/view";

export const runtime = "nodejs";

// The whole save plus the derived view. Creating the player on first read
// means a fresh database boots straight into the starter reveal.
export async function GET() {
  try {
    const save = await ensurePlayer();
    return NextResponse.json(buildView(save));
  } catch (error) {
    console.error("Failed to load save", error);
    return NextResponse.json({ error: "Failed to load save" }, { status: 500 });
  }
}
