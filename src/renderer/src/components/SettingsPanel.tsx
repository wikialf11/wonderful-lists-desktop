import { useState } from "react";
import { Bell, Download, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  bgColor: string;
  inkColor: string;
  onChangeBg: (color: string) => void;
  onChangeInk: (color: string) => void;
  onDeleteList?: () => void;
  listId?: string;
  listName?: string;
  isOwner?: boolean;
};

export const SettingsPanel = ({
  open,
  onClose,
  bgColor,
  inkColor,
  onChangeBg,
  onChangeInk,
  onDeleteList,
  listName,
}: Props) => {
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md p-5 md:p-6 shadow-brutal max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
      >
        <h2 className="display-font text-2xl uppercase mb-6">Ajustes</h2>

        <div className="space-y-3 mb-6">
          <label
            className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer"
            style={{ border: `3px solid ${inkColor}` }}
          >
            <span className="font-mono-brutal text-sm uppercase">Fondo</span>
            <input
              type="color"
              value={bgColor}
              onChange={(event) => onChangeBg(event.target.value)}
              className="w-10 h-10 border-0 p-0 bg-transparent cursor-pointer"
              aria-label="Color de fondo"
            />
          </label>

          <label
            className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer"
            style={{ border: `3px solid ${inkColor}` }}
          >
            <span className="font-mono-brutal text-sm uppercase">Tinta</span>
            <input
              type="color"
              value={inkColor}
              onChange={(event) => onChangeInk(event.target.value)}
              className="w-10 h-10 border-0 p-0 bg-transparent cursor-pointer"
              aria-label="Color de tinta"
            />
          </label>

          <div
            className="px-4 py-3 font-mono-brutal text-[10px] uppercase opacity-70 leading-relaxed"
            style={{ border: `3px solid ${inkColor}` }}
          >
            Tus datos se guardan solo en este ordenador. No hay cuenta, nube ni
            sincronización.
          </div>

          <button
            type="button"
            onClick={async () => {
              const result = await window.desktop?.openDataFolder();
              if (result && !result.ok) toast.error("No se pudo abrir la carpeta de datos");
            }}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 shadow-brutal-hover"
            style={{ border: `3px solid ${inkColor}` }}
          >
            <span className="font-mono-brutal text-sm uppercase">Abrir carpeta de datos</span>
            <FolderOpen className="w-5 h-5" strokeWidth={3} />
          </button>

          <button
            type="button"
            onClick={async () => {
              const result = await window.desktop?.exportBackup();
              if (!result) return;
              if (result.ok) toast.success(`Copia guardada en ${result.path}`);
              else toast.error(result.error);
            }}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 shadow-brutal-hover"
            style={{ border: `3px solid ${inkColor}` }}
          >
            <span className="font-mono-brutal text-sm uppercase">Exportar copia de seguridad</span>
            <Download className="w-5 h-5" strokeWidth={3} />
          </button>

          <button
            type="button"
            onClick={async () => {
              const result = await window.desktop?.testNotification();
              if (result?.permission === "denied") {
                toast.error("macOS tiene bloqueadas las notificaciones. Revisa Ajustes del Sistema → Notificaciones.");
              } else if (result?.supported === false) {
                toast.error("El sistema no soporta notificaciones nativas; verás el aviso dentro de la app.");
              }
            }}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 shadow-brutal-hover"
            style={{ border: `3px solid ${inkColor}` }}
          >
            <span className="font-mono-brutal text-sm uppercase">Probar notificación</span>
            <Bell className="w-5 h-5" strokeWidth={3} />
          </button>
          <p className="font-mono-brutal text-[9px] uppercase opacity-60">
            Los recordatorios avisan con la app abierta. Si está cerrada, se muestran
            la próxima vez que la abras.
          </p>

          {onDeleteList && (confirmDeleteList ? (
            <div className="p-3" style={{ border: `3px solid ${inkColor}` }}>
              <p className="font-mono-brutal text-xs uppercase mb-2">
                ¿Borrar la lista "{listName ?? ""}" y todas sus tareas?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTimeout(() => {
                      onDeleteList();
                      onClose();
                    }, 80);
                  }}
                  className="flex-1 font-mono-brutal uppercase text-xs py-2"
                  style={{ backgroundColor: "hsl(var(--danger))", color: bgColor, border: "3px solid hsl(var(--danger))" }}
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteList(false)}
                  className="flex-1 font-mono-brutal uppercase text-xs py-2"
                  style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteList(true)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 shadow-brutal-hover"
              style={{
                backgroundColor: "hsl(var(--danger))",
                color: bgColor,
                border: "3px solid hsl(var(--danger))",
              }}
            >
              <span className="font-mono-brutal text-sm uppercase">Eliminar lista</span>
              <Trash2 className="w-5 h-5" strokeWidth={3} />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full font-mono-brutal uppercase text-sm py-3 shadow-brutal-hover mt-6"
          style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
