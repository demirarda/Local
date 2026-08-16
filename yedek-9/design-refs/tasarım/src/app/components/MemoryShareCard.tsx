import { Flame } from 'lucide-react';

interface MemoryShareCardProps {
  imageUrl: string;
  host: string;
  timeAgo: string;
  title: string;
  location: string;
  tag: string;
}

export function MemoryShareCard({
  imageUrl,
  host,
  timeAgo,
  title,
  location,
  tag
}: MemoryShareCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#E8D8C8]">
      <div className="p-3 pb-2 border-b border-[#E8D8C8]">
        <div className="text-xs font-semibold text-gray-700 tracking-wide">HOST MEMORY SHARE</div>
      </div>
      
      <div className="flex gap-3 p-3">
        <div className="w-32 h-24 rounded-xl overflow-hidden flex-shrink-0">
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        </div>
        
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="text-xs text-gray-600 mb-1">
              ☀️ Host you follow · {timeAgo}
            </div>
            <div className="text-xs text-gray-500 mb-0.5">Shared a ritual memory</div>
            <div className="font-semibold text-sm mb-0.5">{title}</div>
            <div className="text-xs text-gray-600">{location}</div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-xs">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span className="font-medium text-gray-700">{tag}</span>
            </div>
            
            <button className="bg-[#F5D486] text-[#5A4520] px-4 py-1.5 rounded-full font-semibold text-xs hover:bg-[#f0c870] transition-colors">
              View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
