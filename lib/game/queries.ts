// Server state in the browser, via TanStack Query. The database is the
// source of truth; these are cached copies of it. How a copy gets
// refreshed (polling today, an invalidation from SSE/WebSocket later) is
// decided by the hooks that use these options, not here. Client-safe.

import {
  QueryClient,
  queryOptions,
  replaceEqualDeep,
} from "@tanstack/react-query";
import { loadQuest, loadSave } from "./client";
import type { SaveView } from "./view";

// Player, inventory and achievements are all slices of one save view
// served by one endpoint, so they share the `save` key: splitting keys
// without splitting the endpoint would just refetch the same thing.
export const queryKeys = {
  save: ["save"] as const,
  quests: ["quest"] as const,
  quest: (slug: string) => ["quest", slug] as const,
};

const isSaveView = (value: unknown): value is SaveView =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SaveView).save?.seq === "number";

const isOlder = (candidate: SaveView, than: SaveView) =>
  candidate.save.updatedAt < than.save.updatedAt ||
  (candidate.save.updatedAt === than.save.updatedAt &&
    candidate.save.seq < than.save.seq);

// A refetch that started before a command committed can land after the
// command's own response. Never let that older save replace a newer one.
// (updatedAt comes first so a dev-tools wipe, which restarts seq, still
// counts as newer.)
export const keepNewestSave = (previous: unknown, next: unknown) =>
  isSaveView(previous) && isSaveView(next) && isOlder(next, previous)
    ? previous
    : replaceEqualDeep(previous, next);

export const saveQuery = () =>
  queryOptions({
    queryKey: queryKeys.save,
    queryFn: () => loadSave(),
    structuralSharing: keepNewestSave,
  });

export const questQuery = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.quest(slug),
    queryFn: () => loadQuest(slug),
  });

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Nothing polls by default; screens that need live state opt in
        // (see useQuest). Focus still resyncs everything as a backstop.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
        // Hidden tabs don't poll; this is TanStack's default, stated so
        // nobody flips it without meaning to.
        refetchIntervalInBackground: false,
      },
    },
  });
