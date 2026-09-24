"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/game/queries";

// One QueryClient for the app's lifetime (created lazily so each browser
// session gets its own and the server render never shares one).
export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
