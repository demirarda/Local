import { Users } from 'lucide-react';

interface FriendActivityCardProps {
  title: string;
  location: string;
  startTime: string;
  tags: string[];
}

export function FriendActivityCard({
  title,
  location,
  startTime,
  tags
}: FriendActivityCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#E8D8C8]">
      <div className="p-3 pb-2 border-b border-[#E8D8C8]">
        <div className="text-xs font-semibold text-gray-700 tracking-wide">FRIEND ACTIVITY CARD</div>
      </div>
      
      <div className="p-3 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
          <Users className="w-3.5 h-3.5" />
          <span>Friend Activity</span>
        </div>
        
        <div className="text-xs text-gray-600 mb-1">Someone you know joined:</div>
        <div className="font-semibold text-base mb-0.5">{title}</div>
        <div className="text-sm text-gray-600 mb-2">{location} · {startTime}</div>
        
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {tags.map((tag, i) => (
              <span key={i} className="px-2.5 py-1 bg-[#F5EFE7] text-gray-700 rounded-full text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
          
          <button className="bg-[#F5D486] text-[#5A4520] px-5 py-2 rounded-full font-semibold text-sm hover:bg-[#f0c870] transition-colors">
            Join Them
          </button>
        </div>
      </div>
    </div>
  );
}
