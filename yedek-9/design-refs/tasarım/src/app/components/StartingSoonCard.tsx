interface StartingSoonCardProps {
  title: string;
  startTime: string;
}

export function StartingSoonCard({
  title,
  startTime
}: StartingSoonCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#E8D8C8]">
      <div className="p-3 pb-2 border-b border-[#E8D8C8]">
        <div className="text-xs font-semibold text-gray-700 tracking-wide">STARTING SOON CARD</div>
      </div>
      
      <div className="p-3 pt-2 flex items-center justify-between">
        <div className="font-semibold text-base">{title}</div>
        <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
          Starting in {startTime}
        </span>
      </div>
    </div>
  );
}
