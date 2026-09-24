import { NextResponse } from "next/server";
import { getQuest } from "@/lib/game/content/quests";
import { loadSave } from "@/lib/game/store";
import { buildQuestView } from "@/lib/game/view";

export const runtime = "nodejs";

// One quest's status and saved progress. Small and read-only, so the quest
// screen can poll it cheaply while it is open.
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const quest = getQuest(slug);
  if (!quest)
    return NextResponse.json({ error: "No such quest" }, { status: 404 });
  try {
    return NextResponse.json(buildQuestView(await loadSave(), quest));
  } catch (error) {
    console.error("Failed to load quest", slug, error);
    return NextResponse.json(
      { error: "Failed to load quest" },
      { status: 500 },
    );
  }
};
