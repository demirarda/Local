import { CheckCircle, Users } from 'lucide-react';

interface EventCardProps {
  time: string;
  title: string;
  location: string;
  subLocation: string;
  peopleInterested: number;
  friendsInterested: number;
  tags: string[];
  imageUrl: string;
  isSpecialEvent?: boolean;
  friendAvatars?: string[];
}

export function EventCard({
  time,
  title,
  location,
  subLocation,
  peopleInterested,
  friendsInterested,
  tags,
  imageUrl,
  isSpecialEvent = false,
  friendAvatars = []
}: EventCardProps) {
  return (
    <div className="relative rounded-3xl overflow-hidden h-[240px]">
      <img 
        src={imageUrl} 
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
      
      <div className="relative h-full p-4 flex flex-col justify-between">
        {isSpecialEvent && (
          <div className="self-start">
            <span className="inline-flex items-center gap-1 bg-[#F5D486] text-[#5A4520] px-2.5 py-1 rounded-full text-xs font-medium">
              ⭐ SPECIAL EVENT
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-end">
          <div className="text-white flex-1">
            <div className="text-2xl font-semibold mb-1">{time}</div>
            <div className="text-xl font-semibold mb-0.5">{title}</div>
            <div className="text-sm opacity-90 mb-2">{location} · {subLocation}</div>
            
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-[#4A9EFF]" />
                <span>Verified Venue</span>
              </div>
              <span>·</span>
              <span>{peopleInterested} people interested</span>
            </div>
            
            <div className="flex gap-2 mt-2">
              {tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 ml-3">
            <div className="flex -space-x-2">
              {friendAvatars.slice(0, 4).map((avatar, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-gray-400 border-2 border-white overflow-hidden">
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="text-white text-xs">{friendsInterested} friends are interested</div>
            
            <button className="bg-[#F5D486] text-[#5A4520] px-6 py-2 rounded-full font-semibold text-sm hover:bg-[#f0c870] transition-colors">
              Get Seat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
