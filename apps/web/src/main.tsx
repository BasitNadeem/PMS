import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60,       // 1 min before background refetch
      gcTime:               1000 * 60 * 30,  // keep data in memory 30 min (was 5 min)
      retry:                1,               // retry once on network error (was 3x)
      refetchOnWindowFocus: false,           // don't re-fetch on tab switch
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
