import type { JSX } from "react";
import { Phone, MessageCircle, Mail, MapPin, Copy, QrCode, CreditCard, Clock, MessageSquare, Reply } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/local/client";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  widgets?: string[] | null;
  value: any;
  fieldType: string;
  fieldId: string;
  taskId?: string | null;
  taskName?: string;
  listId?: string | null;
  bgColor: string;
  inkColor: string;
};

type CommentRow = {
  id: string;
  task_id: string;
  list_id: string;
  custom_field_id: string;
  parent_id: string | null;
  author_id: string;
  author_email: string | null;
  body: string;
  created_at: string;
};

const stringValue = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(stringValue).filter(Boolean).join(", ");
  return "";
};

const openLink = (url: string) => {
  try { window.open(url, "_blank", "noopener,noreferrer"); } catch { /* noop */ }
};

export const FieldWidgets = ({ widgets, value, fieldType, fieldId, taskId, taskName, listId, bgColor, inkColor }: Props) => {
  const list = Array.isArray(widgets) ? widgets : [];
  const v = stringValue(value).trim();
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const hasComments = list.includes("comments");
  const canUseDb = !!(hasComments && taskId && listId && fieldId);

  // Load + realtime subscription
  useEffect(() => {
    if (!canUseDb || !showComments) return;
    let cancelled = false;

    const load = async () => {
      setLoadingComments(true);
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId!)
        .eq("custom_field_id", fieldId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) {
          toast.error("No se pudieron cargar los comentarios");
        } else {
          setComments((data ?? []) as CommentRow[]);
        }
        setLoadingComments(false);
      }
    };
    load();

    const channel = supabase
      .channel(`task-comments:${taskId}:${fieldId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `task_id=eq.${taskId}`,
        },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as CommentRow;
          if (!row || row.custom_field_id !== fieldId) return;
          setComments((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some((c) => c.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((c) => (c.id === row.id ? { ...c, ...row } : c));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((c) => c.id !== (payload.old as CommentRow).id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canUseDb, showComments, taskId, fieldId]);

  // Live count when collapsed
  useEffect(() => {
    if (!canUseDb || showComments) return;
    let cancelled = false;
    const loadCount = async () => {
      const { data } = await supabase
        .from("task_comments")
        .select("id, parent_id, body, created_at, author_id, author_email, task_id, list_id, custom_field_id")
        .eq("task_id", taskId!)
        .eq("custom_field_id", fieldId);
      if (!cancelled && data) setComments(data as CommentRow[]);
    };
    loadCount();
    const channel = supabase
      .channel(`task-comments-count:${taskId}:${fieldId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => loadCount()
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [canUseDb, showComments, taskId, fieldId]);

  const addComment = async (body: string, parentId: string | null) => {
    if (!body.trim() || !canUseDb || !user) return;
    const { error } = await supabase.from("task_comments").insert({
      task_id: taskId!,
      list_id: listId!,
      custom_field_id: fieldId,
      parent_id: parentId,
      author_id: user.id,
      author_email: user.email ?? null,
      body: body.trim(),
    });
    if (error) {
      toast.error("No se pudo añadir el comentario");
    }
  };

  const handleAddTopLevel = async () => {
    const text = newComment;
    setNewComment("");
    await addComment(text, null);
  };

  const handleAddReply = async (parentId: string) => {
    const text = replyBody;
    setReplyBody("");
    setReplyTo(null);
    await addComment(text, parentId);
  };

  const removeComment = async (id: string) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", id);
    if (error) toast.error("No se pudo borrar");
  };

  // Build threaded tree
  const tree = useMemo(() => {
    const byParent = new Map<string | null, CommentRow[]>();
    for (const c of comments) {
      const k = c.parent_id;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(c);
    }
    return byParent;
  }, [comments]);

  if (list.length === 0) return null;

  const btnStyle = { border: `2px solid ${inkColor}`, backgroundColor: bgColor, color: inkColor } as const;
  const btn = "font-mono-brutal text-[10px] uppercase px-2 py-1 flex items-center gap-1 shadow-brutal-hover disabled:opacity-30";

  const handlers: Record<string, { icon: JSX.Element; label: string; action: () => void; disabled?: boolean }> = {
    share_whatsapp: {
      icon: <MessageCircle className="w-3 h-3" strokeWidth={3} />,
      label: "WhatsApp",
      disabled: !v && !taskName,
      action: () => {
        const text = encodeURIComponent(`${taskName ?? ""}${v ? `: ${v}` : ""}`.trim());
        openLink(`https://wa.me/?text=${text}`);
      },
    },
    share_email: {
      icon: <Mail className="w-3 h-3" strokeWidth={3} />,
      label: "Email",
      action: () => {
        const subject = encodeURIComponent(taskName ?? "");
        const body = encodeURIComponent(v);
        openLink(`mailto:?subject=${subject}&body=${body}`);
      },
    },
    open_map: {
      icon: <MapPin className="w-3 h-3" strokeWidth={3} />,
      label: "Mapa",
      disabled: !v,
      action: () => openLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`),
    },
    call: {
      icon: <Phone className="w-3 h-3" strokeWidth={3} />,
      label: "Llamar",
      disabled: !v,
      action: () => openLink(`tel:${v.replace(/\s+/g, "")}`),
    },
    copy: {
      icon: <Copy className="w-3 h-3" strokeWidth={3} />,
      label: "Copiar",
      disabled: !v,
      action: async () => {
        try { await navigator.clipboard.writeText(v); toast.success("Copiado"); } catch { toast.error("No se pudo copiar"); }
      },
    },
    qr: {
      icon: <QrCode className="w-3 h-3" strokeWidth={3} />,
      label: "QR",
      disabled: !v,
      action: () => openLink(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(v)}`),
    },
    countdown: {
      icon: <Clock className="w-3 h-3" strokeWidth={3} />,
      label: "Cuenta atrás",
      disabled: !v,
      action: () => {
        const d = new Date(v);
        if (isNaN(d.getTime())) { toast.error("Fecha inválida"); return; }
        const ms = d.getTime() - Date.now();
        if (ms <= 0) { toast.info("Ya ha pasado"); return; }
        const days = Math.floor(ms / 86400000);
        const hours = Math.floor((ms % 86400000) / 3600000);
        toast.info(`Faltan ${days}d ${hours}h`);
      },
    },
  };

  const renderThread = (parentId: string | null, depth: number): JSX.Element[] => {
    const items = tree.get(parentId) ?? [];
    return items.map((c) => {
      const children = tree.get(c.id) ?? [];
      const isOwn = user?.id === c.author_id;
      return (
        <li key={c.id} style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 12}px` : 0 }}>
          <div
            className="p-2"
            style={{ borderLeft: depth > 0 ? `2px solid ${inkColor}` : "none", paddingLeft: depth > 0 ? 8 : 0 }}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono-brutal text-[10px] opacity-60">
                  {new Date(c.created_at).toLocaleString()} · {c.author_email ?? "anónimo"}
                </p>
                <p className="font-mono-brutal text-xs whitespace-pre-wrap break-words">{c.body}</p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyBody(""); }}
                    className="font-mono-brutal text-[9px] uppercase opacity-70 hover:opacity-100 flex items-center gap-1"
                  >
                    <Reply className="w-3 h-3" strokeWidth={3} /> Responder
                  </button>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => removeComment(c.id)}
                      className="font-mono-brutal text-[9px] uppercase opacity-50 hover:opacity-100"
                    >
                      Borrar
                    </button>
                  )}
                </div>
                {replyTo === c.id && (
                  <div className="flex gap-2 mt-2">
                    <input
                      autoFocus
                      aria-label="Respuesta"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddReply(c.id); } }}
                      placeholder="Responder…"
                      className="flex-1 px-2 py-1 font-mono-brutal text-xs bg-transparent outline-hidden"
                      style={{ border: `2px solid ${inkColor}`, color: inkColor }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddReply(c.id)}
                      className="font-mono-brutal text-[10px] uppercase px-2 py-1 shadow-brutal-hover"
                      style={{ border: `2px solid ${inkColor}`, backgroundColor: inkColor, color: bgColor }}
                    >
                      Enviar
                    </button>
                  </div>
                )}
              </div>
            </div>
            {children.length > 0 && (
              <ul className="mt-2 space-y-1">
                {renderThread(c.id, depth + 1)}
              </ul>
            )}
          </div>
        </li>
      );
    });
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {list.map((w) => {
          if (w === "comments") {
            return (
              <button key={w} type="button" onClick={() => setShowComments((s) => !s)}
                className={btn} style={btnStyle}>
                <MessageSquare className="w-3 h-3" strokeWidth={3} />
                Comentarios {comments.length > 0 ? `(${comments.length})` : ""}
              </button>
            );
          }
          const h = handlers[w];
          if (!h) return null;
          return (
            <button key={w} type="button" onClick={h.action} disabled={h.disabled}
              className={btn} style={btnStyle} title={h.label}>
              {h.icon}{h.label}
            </button>
          );
        })}
      </div>

      {hasComments && showComments && (
        <div className="mt-2 p-2" style={{ border: `2px solid ${inkColor}` }}>
          {!canUseDb ? (
            <p className="font-mono-brutal text-[10px] uppercase opacity-60">
              Guarda la tarea para activar los comentarios
            </p>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <input
                  aria-label="Nuevo comentario"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTopLevel(); } }}
                  placeholder="Añadir comentario…"
                  className="flex-1 px-2 py-1 font-mono-brutal text-xs bg-transparent outline-hidden"
                  style={{ border: `2px solid ${inkColor}`, color: inkColor }}
                />
                <button type="button" onClick={handleAddTopLevel}
                  className="font-mono-brutal text-[10px] uppercase px-2 py-1 shadow-brutal-hover"
                  style={{ border: `2px solid ${inkColor}`, backgroundColor: inkColor, color: bgColor }}>
                  Añadir
                </button>
              </div>
              {loadingComments ? (
                <p className="font-mono-brutal text-[10px] uppercase opacity-60">Cargando…</p>
              ) : comments.length === 0 ? (
                <p className="font-mono-brutal text-[10px] uppercase opacity-60">Sin comentarios</p>
              ) : (
                <ul className="space-y-1 max-h-80 overflow-y-auto">
                  {renderThread(null, 0)}
                </ul>
              )}
              <p className="font-mono-brutal text-[9px] uppercase opacity-50 mt-1">
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
