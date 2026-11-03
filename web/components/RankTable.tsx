"use client";

export interface RankRow {
  code: string;
  name: string;
  gebied: string;
  value: number | null;
}

interface Props {
  rows: RankRow[];
  caption: string;
  format: (value: number) => string;
  selected: string | null;
  onSelect: (code: string) => void;
}

/** The accessible twin of the map: every buurt, ranked, reachable by keyboard. */
export default function RankTable({ rows, caption, format, selected, onSelect }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Buurt</th>
            <th scope="col">Area</th>
            <th scope="col" className="num">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.code} className={row.code === selected ? "selected" : undefined}>
              <td>{row.value === null ? "–" : i + 1}</td>
              <th scope="row">
                <button type="button" className="link" onClick={() => onSelect(row.code)}>
                  {row.name}
                </button>
              </th>
              <td>{row.gebied}</td>
              <td className="num">{row.value === null ? "no data" : format(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
