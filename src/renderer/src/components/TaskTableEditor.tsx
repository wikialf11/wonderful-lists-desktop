import { Plus, Trash2 } from "lucide-react";
import { emptyTaskTable, type TaskTable } from "@/lib/taskTable";

type Props = {
  table: TaskTable | null;
  onChange: (table: TaskTable) => void;
  inkColor: string;
  bgColor: string;
};

export function TaskTableEditor({ table, onChange, inkColor, bgColor }: Props) {
  const current = table ?? emptyTaskTable();

  const update = (next: TaskTable) => onChange(next);

  const setColumn = (index: number, value: string) => {
    const columns = [...current.columns];
    columns[index] = value;
    update({ ...current, columns });
  };

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    const rows = current.rows.map((row) => [...row]);
    rows[rowIndex]![columnIndex] = value;
    update({ ...current, rows });
  };

  const addColumn = () => {
    update({
      columns: [...current.columns, `Columna ${current.columns.length + 1}`],
      rows: current.rows.map((row) => [...row, ""]),
    });
  };

  const removeColumn = (index: number) => {
    if (current.columns.length <= 1) return;
    update({
      columns: current.columns.filter((_, i) => i !== index),
      rows: current.rows.map((row) => row.filter((_, i) => i !== index)),
    });
  };

  const addRow = () => {
    update({ ...current, rows: [...current.rows, current.columns.map(() => "")] });
  };

  const removeRow = (index: number) => {
    if (current.rows.length <= 1) return;
    update({ ...current, rows: current.rows.filter((_, i) => i !== index) });
  };

  const inputStyle = {
    backgroundColor: bgColor,
    color: inkColor,
    border: `2px solid ${inkColor}`,
  } as const;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {current.columns.map((column, index) => (
                <th key={index} className="p-1 align-top">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={column}
                      onChange={(event) => setColumn(index, event.target.value)}
                      aria-label={`Columna ${index + 1}`}
                      className="w-full min-w-24 px-2 py-1 font-mono-brutal text-[10px] uppercase outline-hidden"
                      style={inputStyle}
                    />
                    {current.columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(index)}
                        aria-label={`Eliminar columna ${index + 1}`}
                        className="w-6 h-6 shrink-0 flex items-center justify-center"
                        style={inputStyle}
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {current.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {current.columns.map((_, columnIndex) => (
                  <td key={columnIndex} className="p-1">
                    <input
                      type="text"
                      value={row[columnIndex] ?? ""}
                      onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
                      aria-label={`Fila ${rowIndex + 1}, columna ${columnIndex + 1}`}
                      className="w-full min-w-24 px-2 py-1 font-mono-brutal text-xs outline-hidden"
                      style={inputStyle}
                    />
                  </td>
                ))}
                <td className="p-1">
                  {current.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      aria-label={`Eliminar fila ${rowIndex + 1}`}
                      className="w-7 h-7 flex items-center justify-center"
                      style={inputStyle}
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={3} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={addColumn}
          className="flex-1 font-mono-brutal text-[10px] uppercase py-2 flex items-center justify-center gap-1"
          style={{ border: `2px dashed ${inkColor}` }}
        >
          <Plus className="w-3 h-3" strokeWidth={3} /> Columna
        </button>
        <button
          type="button"
          onClick={addRow}
          className="flex-1 font-mono-brutal text-[10px] uppercase py-2 flex items-center justify-center gap-1"
          style={{ border: `2px dashed ${inkColor}` }}
        >
          <Plus className="w-3 h-3" strokeWidth={3} /> Fila
        </button>
      </div>
      <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-2">
        Ejemplo: Hora / Actividad, o Persona / Tarea. Se verá en la tarjeta.
      </p>
    </div>
  );
}
