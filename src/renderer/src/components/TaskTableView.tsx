import { type TaskTable } from "@/lib/taskTable";

type Props = {
  table: TaskTable | null;
  inkColor: string;
  bgColor: string;
};

export function TaskTableView({ table, inkColor, bgColor }: Props) {
  if (!table || table.columns.length === 0 || table.rows.length === 0) return null;

  return (
    <div className="overflow-x-auto" onClick={(event) => event.stopPropagation()}>
      <table className="w-full border-collapse" style={{ border: `2px solid ${inkColor}` }}>
        <thead>
          <tr>
            {table.columns.map((column, index) => (
              <th
                key={index}
                className="px-2 py-1 text-left font-mono-brutal text-[10px] uppercase"
                style={{ backgroundColor: inkColor, color: bgColor, border: `2px solid ${inkColor}` }}
              >
                {column || `Columna ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {table.columns.map((_, columnIndex) => (
                <td
                  key={columnIndex}
                  className="px-2 py-1 font-mono-brutal text-xs align-top"
                  style={{ border: `2px solid ${inkColor}`, minWidth: 90 }}
                >
                  {row[columnIndex] || "\u00A0"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
