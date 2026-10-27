import { Outlet } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-16 pt-10">
        <Outlet />
      </main>
    </div>
  );
}
