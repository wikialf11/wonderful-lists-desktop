import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/local/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type List = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  bg_color: string;
  ink_color: string;
  position: number;
  members_can_edit: boolean;
  is_open: boolean;
  locked: boolean;
};

export const useLists = () => {
  const { user } = useAuth();
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(() =>
    localStorage.getItem("active-list-id")
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lists")
      .select("id, owner_id, name, description, bg_color, ink_color, position, members_can_edit, is_open, locked")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Error cargando listas");
      return;
    }
    let rows = (data ?? []) as List[];

    if (rows.length === 0) {
      const { data: created, error: cErr } = await supabase
        .from("lists")
        .insert({ owner_id: user.id, name: "Mi lista", position: 0 })
        .select("id, owner_id, name, description, bg_color, ink_color, position, members_can_edit, is_open, locked")
        .single();
      if (cErr) {
        toast.error("No se pudo crear la lista inicial");
        return;
      }
      rows = [created as List];
    }

    setLists(rows);
    if ((!activeListId || !rows.find((l) => l.id === activeListId)) && rows[0]) {
      setActiveListId(rows[0].id);
    }
  }, [user, activeListId]);

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Local change notifications: refresh lists when their data changes.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`lists-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lists" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (activeListId) localStorage.setItem("active-list-id", activeListId);
  }, [activeListId]);

  const activeList = lists.find((l) => l.id === activeListId) ?? null;

  const createList = async (name: string, description?: string) => {
    if (!user) return;
    const position = lists.length;
    const { data, error } = await supabase
      .from("lists")
      .insert({ owner_id: user.id, name, description: description?.trim() || null, position })
      .select("id, owner_id, name, description, bg_color, ink_color, position, members_can_edit, is_open, locked")
      .single();
    if (error) {
      toast.error("No se pudo crear");
      return;
    }
    setLists((ls) => [...ls, data as List]);
    setActiveListId((data as List).id);
  };

  const updateList = async (id: string, patch: Partial<List>) => {
    setLists((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("lists").update(patch).eq("id", id);
    if (error) toast.error("No se pudo guardar");
  };

  const deleteList = async (id: string) => {
    const { error } = await supabase.from("lists").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar");
      return;
    }
    setLists((ls) => {
      const next = ls.filter((l) => l.id !== id);
      if (activeListId === id) setActiveListId(next[0]?.id ?? null);
      return next;
    });
  };

  const next = () => {
    if (!activeList || lists.length < 2) return;
    const idx = lists.findIndex((l) => l.id === activeList.id);
    const target = lists[(idx + 1) % lists.length];
    if (target) setActiveListId(target.id);
  };

  const prev = () => {
    if (!activeList || lists.length < 2) return;
    const idx = lists.findIndex((l) => l.id === activeList.id);
    const target = lists[(idx - 1 + lists.length) % lists.length];
    if (target) setActiveListId(target.id);
  };

  return {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    loading,
    reload: load,
    createList,
    updateList,
    deleteList,
    next,
    prev,
  };
};
