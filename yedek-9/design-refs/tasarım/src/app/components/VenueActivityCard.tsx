import { CheckCircle } from 'lucide-react';

interface VenueActivityCardProps {
  venueName: string;
  imageUrl: string;
  activities: Array<{ time: string; title: string }>;
}

export function VenueActivityCard({
  venueName,
  imageUrl,
  activities
}: VenueActivityCardProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden h-[180px]">
      <img 
        src={imageUrl} 
        alt={venueName}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
      
      <div className="relative h-full p-4 flex flex-col justify-between">
        <div className="text-white">
          <div className="text-xs mb-1 opacity-90">VENUE ACTIVITY CARD</div>
          <div className="text-xs mb-3 opacity-75">Venue you follow · Active now</div>
          
          <div className="text-2xl font-semibold mb-2">{venueName}</div>
          
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle className="w-4 h-4 text-[#4A9EFF]" />
            <span>Verified Venue</span>
          </div>
        </div>
        
        <div className="flex items-end justify-between">
          <div className="text-white text-xs">
            <div className="font-semibold mb-1">{activities.length} rituals happening today:</div>
            {activities.map((activity, i) => (
              <div key={i}>• {activity.time} {activity.title}</div>
            ))}
          </div>
          
          <button className="bg-[#F5D486] text-[#5A4520] px-5 py-2 rounded-full font-semibold text-sm hover:bg-[#f0c870] transition-colors">
            See All
          </button>
        </div>
      </div>
    </div>
  );
}
