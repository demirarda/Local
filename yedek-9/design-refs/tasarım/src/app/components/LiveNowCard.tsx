import { CheckCircle } from 'lucide-react';

interface LiveNowCardProps {
  time: string;
  title: string;
  location: string;
  subLocation: string;
  friendsJoined: number;
  seatsLeft: number;
  friendAvatars?: string[];
}

export function LiveNowCard({
  time,
  title,
  location,
  subLocation,
  friendsJoined,
  seatsLeft,
  friendAvatars = []
}: LiveNowCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#E8D8C8]">
      <div className="p-3 pb-2 border-b border-[#E8D8C8]">
        <div className="text-xs font-semibold text-gray-700 tracking-wide">LIVE NOW</div>
      </div>
      
      <div className="p-3 pt-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold">{time}</span>
          </div>
          <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-semibold">
            🔴 LIVE
          </span>
        </div>
        
        <div className="mb-2">
          <div className="font-semibold text-base mb-0.5">{title}</div>
          <div className="text-sm text-gray-600">{location} · {subLocation}</div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-600 mb-1">{friendsJoined} friends just joined</div>
            <div className="flex -space-x-2 mb-2">
              {friendAvatars.slice(0, 2).map((avatar, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white overflow-hidden">
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-orange-600">
              <span className="font-semibold">{seatsLeft} seats left</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
              <CheckCircle className="w-3 h-3 text-[#4A9EFF]" />
              <span>Verified Host</span>
            </div>
          </div>
          
          <button className="bg-red-500 text-white px-6 py-2 rounded-full font-semibold text-sm hover:bg-red-600 transition-colors">
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
