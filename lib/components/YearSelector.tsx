const CURR_YEAR = new Date().getFullYear();

type Props = {
    label?: string;
    value?: number;
    onChange: (year: number) => void;
};

export default function YearSelector({ label, value, onChange}: Props) {    
  return (
    <div>
      <div>
        {label}
      </div>
        <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
        >
        {Array(60).fill(0).map((_, i) => 
            <option key={CURR_YEAR - i} value={CURR_YEAR - i}>{CURR_YEAR - i}</option>
        )}
        </select>
    </div>
  );
}