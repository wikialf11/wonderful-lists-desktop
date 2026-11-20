import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppRoot() {
  useEffect(() => {
    const off = window.desktop?.onReminder((payload) => {
      toast(payload.title, { description: payload.body, duration: 20_000 });
    });
    return () => off?.();
  }, []);

  return (
    <TooltipProvider>
      <Outlet />
      <Toaster />
      <Sonner />
    </TooltipProvider>
  );
}
