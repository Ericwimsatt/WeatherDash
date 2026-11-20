import { createRoot } from "octane";
import { QueryClient, QueryClientProvider } from "@octanejs/tanstack-query";
import { App } from "./App.tsx";
import "./styles.css";
import "./themes/christmas-lights.css";
import "./header-skin.css";
const client = new QueryClient();
function Root() {
  return (
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  );
}
createRoot(document.getElementById("root")!).render(Root, {});
