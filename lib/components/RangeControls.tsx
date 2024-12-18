type Props = {
    label: string,
    range: [number, number],
    setRange: (range: [number, number]) => void,
    lowerBound?: number,
    upperBound?: number,
    onlyMax?: boolean
};
export default function RangeControls({ range, setRange, label, lowerBound = 0, upperBound = 10, onlyMax = false }: Props) {
  const [min, max] = range;
  return (
      <div>
        <div>
          {label}
        </div>
        <div className="flex">
          {!onlyMax && <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              Min: {min}
            </label>
            <input type="range"
              min={lowerBound}
              max={upperBound}
              value={min}
              onChange={(e) => setRange([Number(e.target.value), range[1]])}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          }
          <div className={`flex-1 ${!onlyMax ? 'ml-4' : ''}`}>
            <label className="block text-sm font-medium mb-2">
              {!onlyMax && 'Max: '} {max}
            </label>
            <input
              type="range"
              min={lowerBound}
              max={upperBound}
              value={max}
              onChange={(e) => setRange([range[0], Number(e.target.value)])}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
  );
}