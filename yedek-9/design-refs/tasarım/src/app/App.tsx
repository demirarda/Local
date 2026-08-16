import { Plus, MoreHorizontal, Zap, Calendar, User } from 'lucide-react';
import { EventCard } from './components/EventCard';
import { MemoryShareCard } from './components/MemoryShareCard';
import { LiveNowCard } from './components/LiveNowCard';
import { VenueActivityCard } from './components/VenueActivityCard';
import { FriendActivityCard } from './components/FriendActivityCard';
import { StartingSoonCard } from './components/StartingSoonCard';
import jazzNightImage from 'figma:asset/d74d959245464c4b7fa0569673256b0d8bb4560d.png';

export default function App() {
  const filterTabs = ['All', 'Live Now', 'Friends', 'Followed', 'Special Events'];
  const activeTab = 'All';

  return (
    <div className="min-h-screen bg-[#F5EFE7] flex justify-center">
      {/* iPhone Frame */}
      <div className="w-full max-w-[430px] h-screen bg-[#F5EFE7] flex flex-col">
        {/* Status Bar */}
        <div className="px-6 pt-3 pb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 border border-black rounded-sm" />
            <div className="w-6 h-3 border border-black rounded-sm" />
          </div>
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between">
          <button className="flex items-center gap-2 bg-[#F5D486] rounded-full px-4 py-2.5 hover:bg-[#f0c870] transition-colors">
            <div className="w-8 h-8 bg-[#f0c870] rounded-full flex items-center justify-center">
              <Plus className="w-5 h-5 text-[#5A4520]" />
            </div>
            <div className="text-left">
              <div className="text-xs font-medium text-[#5A4520]">Create</div>
              <div className="text-xs font-medium text-[#5A4520]">Ritual</div>
            </div>
          </button>

          <div className="text-center flex-1 mx-4">
            <div className="text-xs text-gray-600 tracking-wide">LOCALE</div>
            <h1 className="text-3xl font-serif">Pulse</h1>
            <div className="text-xs text-gray-600">Your City Feed</div>
          </div>

          <button className="w-10 h-10 bg-[#E8D8C8] rounded-full flex items-center justify-center hover:bg-[#dcc8b0] transition-colors">
            <MoreHorizontal className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-5 mb-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === activeTab
                    ? 'bg-[#F5D486] text-[#5A4520]'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Feed Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4">
          <EventCard
            time="20:30 Tonight"
            title="Jazz Night at Blue Note"
            location="Navigli"
            subLocation="Milano"
            peopleInterested={45}
            friendsInterested={8}
            tags={['Music', 'Social', 'Vibrant']}
            imageUrl={jazzNightImage}
            isSpecialEvent={true}
            friendAvatars={[
              'https://i.pravatar.cc/150?img=1',
              'https://i.pravatar.cc/150?img=2',
              'https://i.pravatar.cc/150?img=3',
              'https://i.pravatar.cc/150?img=4'
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <MemoryShareCard
              imageUrl="https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400"
              host="Host you follow"
              timeAgo="45m ago"
              title="Sunset Aperitivo"
              location="Terrazza Aperol"
              tag="High energy"
            />

            <LiveNowCard
              time="11:30"
              title="Brunch Circle"
              location="Brera"
              subLocation="Milano"
              friendsJoined={2}
              seatsLeft={6}
              friendAvatars={[
                'https://i.pravatar.cc/150?img=5',
                'https://i.pravatar.cc/150?img=6'
              ]}
            />
          </div>

          <VenueActivityCard
            venueName="Caffè Letterario"
            imageUrl="https://images.unsplash.com/photo-1762922425310-cf31b9befba0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpdGFsaWFuJTIwY2FmZSUyMGludGVyaW9yJTIwYXRtb3NwaGVyZXxlbnwxfHx8fDE3NzA3NTk1MjR8MA&ixlib=rb-4.1.0&q=80&w=1080"
            activities={[
              { time: '14:00', title: 'Book Discussion' },
              { time: '17:00', title: 'Writing Circle' },
              { time: '20:00', title: 'Poetry Reading' }
            ]}
          />

          <FriendActivityCard
            title="Morning Yoga Session"
            location="Parco Sempione"
            startTime="Starting in 25 min"
            tags={['Calm', 'Active']}
          />

          <StartingSoonCard
            title="Sunset Run & Chill"
            startTime="1h 15m"
          />
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#F5EFE7] border-t border-[#E8D8C8]">
          <div className="flex items-center justify-around px-8 py-3 max-w-[430px] mx-auto">
            <button className="flex flex-col items-center gap-1 text-[#F5A524]">
              <Zap className="w-6 h-6 fill-current" />
              <span className="text-xs font-medium">Pulse</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-900">
              <Calendar className="w-6 h-6" />
              <span className="text-xs font-medium">City Rhythm</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-900">
              <User className="w-6 h-6" />
              <span className="text-xs font-medium">Social Passport</span>
            </button>
          </div>
          {/* iPhone Home Indicator */}
          <div className="flex justify-center pb-2">
            <div className="w-32 h-1 bg-black rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
