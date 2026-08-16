import { useState, useEffect, useRef } from "react";

const MOCK_DATA = {
  overview: {
    totalUsers: 847,
    activeUsers: 312,
    totalRituals: 89,
    userInitiatedRituals: 23,
    avgRS: 6.4,
  },
  weeklySnapshots: [
    { week: "W1", users: 48, rituals: 3, userRituals: 0, repeatRate: 0, noShow: 35, kFactor: 0.3, organicInvite: 8 },
    { week: "W2", users: 112, rituals: 7, userRituals: 0, repeatRate: 18, noShow: 31, kFactor: 0.5, organicInvite: 14 },
    { week: "W3", users: 198, rituals: 12, userRituals: 1, repeatRate: 26, noShow: 27, kFactor: 0.6, organicInvite: 19 },
    { week: "W4", users: 287, rituals: 18, userRituals: 2, repeatRate: 32, noShow: 24, kFactor: 0.7, organicInvite: 22 },
    { week: "W5", users: 390, rituals: 26, userRituals: 4, repeatRate: 36, noShow: 22, kFactor: 0.8, organicInvite: 27 },
    { week: "W6", users: 478, rituals: 35, userRituals: 7, repeatRate: 39, noShow: 20, kFactor: 0.85, organicInvite: 30 },
    { week: "W7", users: 580, rituals: 47, userRituals: 11, repeatRate: 42, noShow: 19, kFactor: 0.9, organicInvite: 33 },
    { week: "W8", users: 672, rituals: 58, userRituals: 14, repeatRate: 44, noShow: 18, kFactor: 0.95, organicInvite: 35 },
    { week: "W9", users: 756, rituals: 71, userRituals: 18, repeatRate: 46, noShow: 17, kFactor: 1.0, organicInvite: 38 },
    { week: "W10", users: 847, rituals: 89, userRituals: 23, repeatRate: 48, noShow: 16, kFactor: 1.05, organicInvite: 41 },
  ],
  rsDistribution: [
    { range: "1.0–2.0", count: 12 },
    { range: "2.1–3.0", count: 28 },
    { range: "3.1–4.0", count: 45 },
    { range: "4.1–5.0", count: 67 },
    { range: "5.1–6.0", count: 89 },
    { range: "6.1–7.0", count: 112 },
    { range: "7.1–8.0", count: 78 },
    { range: "8.1–9.0", count: 34 },
    { range: "9.1–10.0", count: 8 },
  ],
  milestones: [
    { label: "150+ benzersiz katilimci", target: 150, current: 312, unit: "kisi" },
    { label: "Tekrar katilim ≥40%", target: 40, current: 48, unit: "%" },
    { label: "Gelmeme ≤20%", target: 20, current: 16, unit: "%", inverse: true },
    { label: "Organik davet ≥30%", target: 30, current: 41, unit: "%" },
    { label: "K-Factor ≥1.0", target: 1.0, current: 1.05, unit: "k" },
    { label: "Kullanici baslatilan ritueller", target: 15, current: 23, unit: "#" },
  ],
  topRituals: [
    { name: "Kadıköy Aperitivo", attendees: 24, repeatRate: 62, avgRS: 7.8, type: "pivot" },
    { name: "Cihangir Coffee Walk", attendees: 18, repeatRate: 55, avgRS: 7.2, type: "user" },
    { name: "Beşiktaş Vinyl Night", attendees: 31, repeatRate: 58, avgRS: 7.5, type: "pivot" },
    { name: "Moda Sahil Run", attendees: 16, repeatRate: 48, avgRS: 6.9, type: "user" },
    { name: "Karaköy Art Crawl", attendees: 22, repeatRate: 51, avgRS: 7.1, type: "pivot" },
  ],
  rsImpact: {
    highRS: { noShow: 8, satisfaction: 92, repeatRate: 67 },
    lowRS: { noShow: 34, satisfaction: 61, repeatRate: 22 },
  }
};

const MiniChart = ({ data, dataKey, color = "#fff", height = 60, showTarget, targetValue, targetColor = "#555" }) => {
  const max = Math.max(...data.map(d => d[dataKey])) * 1.2;
  const min = Math.min(...data.map(d => d[dataKey])) * 0.8;
  const range = max - min || 1;
  const w = 100 / (data.length - 1);

  const points = data.map((d, i) => {
    const x = i * w;
    const y = 100 - ((d[dataKey] - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  const targetY = showTarget ? 100 - ((targetValue - min) / range) * 100 : null;

  return (
    <svg viewBox={`0 0 100 100`} style={{ width: "100%", height, overflow: "visible" }} preserveAspectRatio="none">
      {showTarget && (
        <line x1="0" y1={targetY} x2="100" y2={targetY} stroke={targetColor} strokeWidth="0.8" strokeDasharray="3,3" />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d, i) => {
        const x = i * w;
        const y = 100 - ((d[dataKey] - min) / range) * 100;
        return i === data.length - 1 ? (
          <circle key={i} cx={x} cy={y} r="2.5" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        ) : null;
      })}
    </svg>
  );
};

const BarChart = ({ data, maxVal }) => {
  const max = maxVal || Math.max(...data.map(d => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, padding: "0 4px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: "100%",
              height: `${(d.count / max) * 100}%`,
              background: `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 100%)`,
              borderRadius: "2px 2px 0 0",
              minHeight: 2,
              transition: "height 0.6s ease",
            }}
          />
          <span style={{ fontSize: 8, color: "#666", whiteSpace: "nowrap", letterSpacing: -0.3 }}>{d.range}</span>
        </div>
      ))}
    </div>
  );
};

const Pulse = ({ active }) => (
  <span style={{
    display: "inline-block",
    width: 8, height: 8,
    borderRadius: "50%",
    background: active ? "#00ff88" : "#ff4444",
    boxShadow: active ? "0 0 8px #00ff88" : "0 0 8px #ff4444",
    animation: active ? "pulse 2s infinite" : "none",
    marginRight: 8,
  }} />
);

const MilestoneBar = ({ label, target, current, unit, inverse }) => {
  let progress;
  if (inverse) {
    progress = current <= target ? 100 : Math.max(0, (1 - (current - target) / target) * 100);
  } else if (unit === "k") {
    progress = Math.min(100, (current / target) * 100);
  } else {
    progress = Math.min(100, (current / target) * 100);
  }
  const achieved = inverse ? current <= target : current >= target;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#999", fontFamily: "'Outfit', sans-serif" }}>{label}</span>
        <span style={{
          fontSize: 12,
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 600,
          color: achieved ? "#00ff88" : "#fff",
        }}>
          {achieved ? "✓ " : ""}{current}{unit === "%" ? "%" : unit === "k" ? "" : ""}
        </span>
      </div>
      <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: achieved
            ? "linear-gradient(90deg, #00ff88, #00cc6a)"
            : "linear-gradient(90deg, #fff, #888)",
          borderRadius: 2,
          transition: "width 1s ease",
        }} />
      </div>
    </div>
  );
};

export default function LocalDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  const d = MOCK_DATA;

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
  }, []);

  const cardStyle = {
    background: "#0a0a0a",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    padding: 24,
    transition: "all 0.3s ease",
  };

  const statStyle = {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 42,
    fontWeight: 300,
    color: "#fff",
    lineHeight: 1,
    letterSpacing: -1,
  };

  const labelStyle = {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 11,
    fontWeight: 400,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 2,
  };

  const tabs = [
    { id: "overview", label: "Genel Bakis" },
    { id: "rituals", label: "Ritueller" },
    { id: "algorithm", label: "RS Algoritmasi" },
    { id: "growth", label: "Buyume" },
    { id: "milestones", label: "Kilometre Taslari" },
  ];

  const userRitualRatio = d.weeklySnapshots.length > 0
    ? ((d.overview.userInitiatedRituals / d.overview.totalRituals) * 100).toFixed(0)
    : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      color: "#fff",
      fontFamily: "'Outfit', sans-serif",
      opacity: loaded ? 1 : 0,
      transition: "opacity 0.8s ease",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Outfit:wght@300;400;500;600&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "32px 40px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}>
        <div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: 6,
            marginBottom: 4,
          }}>
            L.
          </div>
          <div style={{ ...labelStyle, marginTop: 8 }}>
            LAUNCH COMMAND CENTER
          </div>
          <div style={{ fontSize: 13, color: "#333", marginTop: 4 }}>
            Istanbul Pilot · Week 10
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Pulse active={true} />
          <span style={{ fontSize: 12, color: "#555" }}>Live Tracking</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        padding: "24px 40px 0",
        borderBottom: "1px solid #111",
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "1px solid #fff" : "1px solid transparent",
              color: activeTab === tab.id ? "#fff" : "#444",
              fontFamily: "'Outfit', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "12px 20px",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "32px 40px", animation: "slideUp 0.5s ease" }}>

        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {/* Big number cards */}
            <div style={cardStyle}>
              <div style={labelStyle}>Toplam Kullanici</div>
              <div style={{ ...statStyle, marginTop: 12 }}>{d.overview.totalUsers}</div>
              <div style={{ marginTop: 16 }}>
                <MiniChart data={d.weeklySnapshots} dataKey="users" height={50} />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Toplam Rituel</div>
              <div style={{ ...statStyle, marginTop: 12 }}>{d.overview.totalRituals}</div>
              <div style={{ marginTop: 16 }}>
                <MiniChart data={d.weeklySnapshots} dataKey="rituals" height={50} />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Avg Reliability Score</div>
              <div style={{ ...statStyle, marginTop: 12 }}>{d.overview.avgRS}</div>
              <div style={{
                marginTop: 16,
                height: 4,
                background: "#1a1a1a",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${(d.overview.avgRS / 10) * 100}%`,
                  background: "linear-gradient(90deg, #333, #fff)",
                  borderRadius: 2,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "#333" }}>1.0</span>
                <span style={{ fontSize: 9, color: "#333" }}>10.0</span>
              </div>
            </div>

            {/* Temel metrik */}
            <div style={{
              ...cardStyle,
              gridColumn: "span 2",
              border: "1px solid #222",
              background: "linear-gradient(135deg, #0a0a0a 0%, #0d0d0d 100%)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ ...labelStyle, color: "#00ff88" }}>★ TEMEL METRIK — KULLANICI BASLATILAN RITUELLER</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 12 }}>
                    <span style={{ ...statStyle, fontSize: 56 }}>{d.overview.userInitiatedRituals}</span>
                    <span style={{ fontSize: 14, color: "#555" }}>/ {d.overview.totalRituals} toplam</span>
                    <span style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#00ff88",
                      fontFamily: "'Outfit', sans-serif",
                    }}>
                      {userRitualRatio}%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#444", marginTop: 8 }}>
                    Kullanicilar kendi rituellerini olusturuyor = platform calisiyor
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <MiniChart
                  data={d.weeklySnapshots}
                  dataKey="userRituals"
                  color="#00ff88"
                  height={60}
                />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Aktif / Toplam</div>
              <div style={{ ...statStyle, marginTop: 12, fontSize: 36 }}>
                {((d.overview.activeUsers / d.overview.totalUsers) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 13, color: "#444", marginTop: 8 }}>
                {d.overview.activeUsers} aktif kullanici
              </div>
              <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>
                (son 14 gunde rituele katilan)
              </div>
            </div>
          </div>
        )}

        {activeTab === "rituals" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ ...cardStyle, gridColumn: "span 2" }}>
              <div style={labelStyle}>Tekrar Katilim Orani</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
                <span style={statStyle}>{d.weeklySnapshots[d.weeklySnapshots.length - 1].repeatRate}%</span>
                <span style={{ fontSize: 12, color: d.weeklySnapshots[d.weeklySnapshots.length - 1].repeatRate >= 40 ? "#00ff88" : "#ff8800", }}>
                  {d.weeklySnapshots[d.weeklySnapshots.length - 1].repeatRate >= 40 ? "HEDEF TUTTU ✓" : `Hedef: 40%`}
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <MiniChart
                  data={d.weeklySnapshots}
                  dataKey="repeatRate"
                  height={70}
                  showTarget
                  targetValue={40}
                  targetColor="#00ff8844"
                />
              </div>
              <div style={{ fontSize: 10, color: "#333", marginTop: 8, textAlign: "right" }}>
                — — hedef 40%
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Gelmeme Orani</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
                <span style={statStyle}>{d.weeklySnapshots[d.weeklySnapshots.length - 1].noShow}%</span>
                <span style={{ fontSize: 12, color: d.weeklySnapshots[d.weeklySnapshots.length - 1].noShow <= 20 ? "#00ff88" : "#ff4444" }}>
                  {d.weeklySnapshots[d.weeklySnapshots.length - 1].noShow <= 20 ? "HEDEF TUTTU ✓" : `Hedef: ≤20%`}
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <MiniChart data={d.weeklySnapshots} dataKey="noShow" color="#ff6666" height={60} showTarget targetValue={20} targetColor="#ff444444" />
              </div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 12 }}>
                RS baskısı çalışıyor — insanlar gelmeme korkusu yaşıyor
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>En Iyi Ritueller</div>
              <div style={{ marginTop: 16 }}>
                {d.topRituals.map((r, i) => (
                  <div key={i} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: i < d.topRituals.length - 1 ? "1px solid #111" : "none",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#ccc" }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
                        <span style={{
                          color: r.type === "user" ? "#00ff88" : "#666",
                          fontWeight: r.type === "user" ? 600 : 400,
                        }}>
                          {r.type === "user" ? "KULLANICI OLUSTURDU" : "PIVOT HOST"}
                        </span>
                        {" · "}{r.attendees} katılımcı
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.repeatRate}%</div>
                      <div style={{ fontSize: 9, color: "#444" }}>tekrar</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "algorithm" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* RS Impact Comparison */}
            <div style={{ ...cardStyle, gridColumn: "span 2" }}>
              <div style={labelStyle}>RS Etkisi — Yuksek RS ve Dusuk RS Ritueller</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 4, marginBottom: 20 }}>
                RS gercekten guveni olcuyor mu? Yuksek RS gruplari ile dusuk RS gruplari karsilastirmasi
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
                {[
                  { label: "Gelmeme Orani", high: d.rsImpact.highRS.noShow, low: d.rsImpact.lowRS.noShow, unit: "%", lowerBetter: true },
                  { label: "Memnuniyet", high: d.rsImpact.highRS.satisfaction, low: d.rsImpact.lowRS.satisfaction, unit: "%", lowerBetter: false },
                  { label: "Tekrar Orani", high: d.rsImpact.highRS.repeatRate, low: d.rsImpact.lowRS.repeatRate, unit: "%", lowerBetter: false },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#555", marginBottom: 16, letterSpacing: 1 }}>{m.label}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 28, fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, color: "#00ff88" }}>
                          {m.high}{m.unit}
                        </div>
                        <div style={{ fontSize: 9, color: "#00ff88", marginTop: 4 }}>YUKSEK RS</div>
                      </div>
                      <div style={{ width: 1, background: "#1a1a1a" }} />
                      <div>
                        <div style={{ fontSize: 28, fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, color: "#ff4444" }}>
                          {m.low}{m.unit}
                        </div>
                        <div style={{ fontSize: 9, color: "#ff4444", marginTop: 4 }}>DUSUK RS</div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: "#333",
                      marginTop: 12,
                      padding: "4px 8px",
                      background: "#0d0d0d",
                      borderRadius: 4,
                      display: "inline-block",
                    }}>
                      {m.lowerBetter
                        ? `${((1 - m.high / m.low) * 100).toFixed(0)}% daha az`
                        : `${(((m.high - m.low) / m.low) * 100).toFixed(0)}% daha iyi`
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RS Distribution */}
            <div style={cardStyle}>
              <div style={labelStyle}>RS Distribution</div>
              <div style={{ marginTop: 16 }}>
                <BarChart data={d.rsDistribution} />
              </div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 12 }}>
                Sağlıklı dağılım — çan eğrisi 6-7 etrafında yoğunlaşıyor
              </div>
            </div>

            {/* RS Check Frequency */}
            <div style={cardStyle}>
              <div style={labelStyle}>RS Behavioral Signals</div>
              <div style={{ marginTop: 20 }}>
                {[
                  { label: "RS'ini günde 1+ kez kontrol eden", value: "34%", status: "strong" },
                  { label: "RS düştükten sonra davranış değiştiren", value: "61%", status: "strong" },
                  { label: "Profilinde RS'ini gösteren", value: "78%", status: "strong" },
                  { label: "RS hakkında sosyal medya paylaşımı", value: "12%", status: "growing" },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: i < 3 ? "1px solid #111" : "none",
                  }}>
                    <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: s.status === "strong" ? "#fff" : "#666",
                    }}>{s.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#00ff88", marginTop: 16 }}>
                İnsanlar RS'i önemsiyor = algoritma çalışıyor
              </div>
            </div>
          </div>
        )}

        {activeTab === "growth" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={cardStyle}>
              <div style={labelStyle}>K-Factor (Viral Coefficient)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
                <span style={{
                  ...statStyle,
                  color: d.weeklySnapshots[d.weeklySnapshots.length - 1].kFactor >= 1.0 ? "#00ff88" : "#fff",
                }}>
                  {d.weeklySnapshots[d.weeklySnapshots.length - 1].kFactor.toFixed(2)}
                </span>
                <span style={{ fontSize: 12, color: d.weeklySnapshots[d.weeklySnapshots.length - 1].kFactor >= 1.0 ? "#00ff88" : "#ff8800" }}>
                  {d.weeklySnapshots[d.weeklySnapshots.length - 1].kFactor >= 1.0 ? "ORGANIK BUYUME ✓" : "Hedef: ≥1.0"}
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <MiniChart
                  data={d.weeklySnapshots}
                  dataKey="kFactor"
                  color="#00ff88"
                  height={60}
                  showTarget
                  targetValue={1.0}
                  targetColor="#00ff8844"
                />
              </div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>
                K≥1.0 = her kullanıcı en az 1 yeni kullanıcı getiriyor
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Organik Davet Orani</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
                <span style={statStyle}>{d.weeklySnapshots[d.weeklySnapshots.length - 1].organicInvite}%</span>
              </div>
              <div style={{ marginTop: 16 }}>
                <MiniChart data={d.weeklySnapshots} dataKey="organicInvite" height={60} showTarget targetValue={30} targetColor="#ffffff22" />
              </div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>
                Davet edilmeden uygulamayı bulan / organik gelen oran
              </div>
            </div>

            <div style={{ ...cardStyle, gridColumn: "span 2" }}>
              <div style={labelStyle}>Haftalik Kullanici Buyumesi</div>
              <div style={{ marginTop: 16 }}>
                <MiniChart data={d.weeklySnapshots} dataKey="users" height={80} />
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 12,
                padding: "12px 0 0",
                borderTop: "1px solid #111",
              }}>
                {d.weeklySnapshots.map((w, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#333" }}>{w.week}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{w.users}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "milestones" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ ...cardStyle, gridColumn: "span 2" }}>
              <div style={labelStyle}>3. Ay Kilometre Taslari</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 4, marginBottom: 24 }}>
                Istanbul calisti mi? → Sonraki sehir karari bu metriklere bagli
              </div>
              {d.milestones.map((m, i) => (
                <MilestoneBar key={i} {...m} />
              ))}
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Lansman Asamasi</div>
              <div style={{ marginTop: 20 }}>
                {[
                  { phase: "1. Ay", desc: "10-15 Pivot Host ritueli, 150+ benzersiz", status: "done" },
                  { phase: "3. Ay", desc: "500+ aktif, tekrar ≥40%", status: "done" },
                  { phase: "6. Ay", desc: "2000+ kullanici, kullanici baslatilan ↑", status: "active" },
                  { phase: "Sonraki Sehir", desc: "Milano veya Londra lansmani", status: "upcoming" },
                  { phase: "Tohum Yatirim", desc: "Veri ile yatirim turu", status: "upcoming" },
                ].map((p, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: i < 4 ? "1px solid #111" : "none",
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: p.status === "done" ? "#00ff88" : p.status === "active" ? "#fff" : "#222",
                      boxShadow: p.status === "active" ? "0 0 8px #fff" : "none",
                      flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontSize: 13, color: p.status === "upcoming" ? "#444" : "#ccc", fontWeight: 500 }}>
                        {p.phase}
                      </div>
                      <div style={{ fontSize: 11, color: "#444" }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Decision Framework</div>
              <div style={{ marginTop: 20, fontSize: 13, color: "#888", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ color: "#00ff88", fontWeight: 600 }}>DEVAM ET →</span>{" "}
                  <span style={{ color: "#666" }}>
                    Tekrar ≥40%, Gelmeme ≤20%, K≥1.0, Kullanici rituelleri ↑
                  </span>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ color: "#ff8800", fontWeight: 600 }}>IYILESTIR →</span>{" "}
                  <span style={{ color: "#666" }}>
                    2/4 metrik tuttu, trend yukari ama henuz hedefte degil
                  </span>
                </div>
                <div>
                  <span style={{ color: "#ff4444", fontWeight: 600 }}>YON DEGISTIR →</span>{" "}
                  <span style={{ color: "#666" }}>
                    3 ay sonra hicbir metrik hedefe yaklasmiyorsa
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "24px 40px",
        borderTop: "1px solid #0a0a0a",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 10, color: "#222", letterSpacing: 2 }}>
          LOCAL © 2026 — BEHAVIORAL INFRASTRUCTURE
        </span>
        <span style={{ fontSize: 10, color: "#222" }}>
          Ornek veri — canli backend baglantisi gerekli
        </span>
      </div>
    </div>
  );
}
