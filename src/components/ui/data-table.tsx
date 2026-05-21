import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  tabularNums?: boolean;
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyState?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyState = "No entries yet.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant text-center py-lg">
        {emptyState}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-surface-container-low">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  "text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm",
                  column.align === "right" ? "text-right" : "text-left",
                ].join(" ")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="hover:bg-surface-container-low transition-colors group"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[
                    "px-md py-sm text-body-sm text-on-surface",
                    column.align === "right" ? "text-right" : "text-left",
                    column.tabularNums ? "tabular-nums" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
