export default function RangeControls({ range, setRange, label}: { label: string,range: [number, number], setRange: (range: [number, number]) => void }) {
  const [min, max] = range;
  return (
      <div className="mb-6 flex flex-1 flex-col ml-8">
        <div>
          {label}
        </div>
        <div className="flex flex-row">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              Min: {min}
            </label>
            <input type="range"
              min="4"
              max="20"
              value={min}
              onChange={(e) => setRange([Number(e.target.value), range[1]])}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="flex-1 ml-4">
            <label className="block text-sm font-medium mb-2">
              Max: {max}
            </label>
            <input
              type="range"
              min="4"
              max="20"
              value={max}
              onChange={(e) => setRange([range[0], Number(e.target.value)])}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
  );
}