interface KpiTableProps {
  caption: string;
  headings: string[];
  rows: string[][];
}

export function KpiTable({ caption, headings, rows }: KpiTableProps) {
  return (
    <div
      className="hr-kpi-table-wrap"
      role="region"
      aria-label={`Tabela de dados: ${caption}. Se necessário, use as setas para rolar horizontal ou verticalmente.`}
      tabIndex={0}
    >
      <table className="hr-kpi-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${caption}-${index}`}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={`${index}-${cellIndex}`} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={`${index}-${cellIndex}`}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
