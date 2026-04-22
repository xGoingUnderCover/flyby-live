import { useState, useEffect, useCallback, useRef } from "react";

const AIRLINE_MAP = {
  UAL:"UNITED",DAL:"DELTA",AAL:"AMERICAN",SWA:"SOUTHWEST",JBU:"JETBLUE",
  NKS:"SPIRIT",FFT:"FRONTIER",ASA:"ALASKA",FDX:"FEDEX",UPS:"UPS AIR",
  WJA:"WESTJET",ACA:"AIR CANADA",BAW:"BRIT AIR",DLH:"LUFTHANSA",
  AFR:"AIR FRANCE",KLM:"KLM",IBE:"IBERIA",UAE:"EMIRATES",QTR:"QATAR",
  THY:"TURKISH",VIR:"VIRGIN ATL",EIN:"AER LINGUS",CLX:"CARGOLUX",
  ENY:"ENVOY",SKW:"SKYWEST",RPA:"REPUBLIC",CPZ:"COLGAN",
};

const getAirline = (flight) => {
  if (!flight) return "UNKNOWN";
  const code = flight.slice(0,3).toUpperCase();
  return AIRLINE_MAP[code] || flight.trim().toUpperCase().slice(0,10);
};

const getHeading = (track) => {
  if (track == null) return "---";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(track / 22.5) % 16];
};

const feetAlt = (ft) =>
  ft != null && ft !== "ground" && !isNaN(ft) ? Math.round(ft).toLocaleString() : "----";
const fmtSpd = (kts) => kts != null ? Math.round(kts) : 0;

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const ACCENT = {
  UAL:"#1a44bb",DAL:"#cc0022",AAL:"#0066cc",SWA:"#dd8800",
  JBU:"#0055aa",FDX:"#8800cc",UPS:"#5c3317",NKS:"#ccbb00"
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#080600;font-family:'Share Tech Mono',monospace;color:#ff9900;}

.scanlines{position:fixed;inset:0;pointer-events:none;z-index:300;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);}
.vignette{position:fixed;inset:0;pointer-events:none;z-index:299;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,0.55) 100%);}

/* ── Landing ── */
.landing{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;gap:0;}
.brand{font-family:'Orbitron',monospace;font-weight:900;font-size:clamp(36px,8vw,80px);color:#ffb300;text-shadow:0 0 30px #ff9900,0 0 60px #ff6600;letter-spacing:6px;line-height:1;animation:glow 3s ease-in-out infinite;}
@keyframes glow{0%,100%{text-shadow:0 0 30px #ff9900,0 0 60px #ff6600;}50%{text-shadow:0 0 40px #ffcc00,0 0 80px #ff8800;}}
.brand-plane{font-size:clamp(28px,5vw,56px);margin-right:12px;display:inline-block;animation:flyIn 1.2s ease-out;}
@keyframes flyIn{from{transform:translateX(-80px);opacity:0;}to{transform:translateX(0);opacity:1;}}
.tagline{font-size:clamp(12px,2vw,16px);color:#aa6600;letter-spacing:4px;margin-top:12px;margin-bottom:48px;}
.zip-form{display:flex;gap:0;align-items:stretch;width:100%;max-width:380px;}
.zip-input{flex:1;background:#0f0900;border:2px solid #3a2200;border-right:none;color:#ffcc00;font-family:'Orbitron',monospace;font-size:22px;font-weight:700;letter-spacing:6px;padding:14px 16px;outline:none;text-align:center;transition:border-color 0.2s;}
.zip-input::placeholder{color:#3a2200;letter-spacing:4px;}
.zip-input:focus{border-color:#ff9900;}
.zip-btn{background:#ff8800;border:2px solid #ff8800;color:#000;font-family:'Orbitron',monospace;font-size:13px;font-weight:900;letter-spacing:2px;padding:14px 20px;cursor:pointer;transition:background 0.15s;white-space:nowrap;}
.zip-btn:hover{background:#ffaa00;border-color:#ffaa00;}
.zip-btn:disabled{opacity:0.5;cursor:not-allowed;}
.zip-error{margin-top:12px;font-size:12px;color:#ff4400;letter-spacing:2px;}
.features{display:flex;gap:32px;margin-top:64px;flex-wrap:wrap;justify-content:center;}
.feat{font-size:11px;color:#553300;letter-spacing:2px;text-align:center;}
.feat-icon{font-size:22px;display:block;margin-bottom:6px;}

/* ── Header ── */
.wall{min-height:100vh;background:#080600;}
.hdr{padding:12px 24px 10px;border-bottom:2px solid #2a1800;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.hdr-left{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.logo{font-family:'Orbitron',monospace;font-weight:900;font-size:18px;color:#ffb300;text-shadow:0 0 16px #ff9900,0 0 32px #ff6600;letter-spacing:3px;cursor:pointer;white-space:nowrap;}
.logo:hover{color:#ffcc44;}
.location-badge{font-size:10px;color:#884400;letter-spacing:2px;white-space:nowrap;}
.change-zip{background:none;border:1px solid #2a1800;color:#664400;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;padding:3px 10px;cursor:pointer;transition:all 0.15s;}
.change-zip:hover{border-color:#ff9900;color:#ff9900;}
.hdr-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
.clock{font-family:'Orbitron',monospace;font-size:18px;color:#ffcc00;text-shadow:0 0 10px #ffaa00;letter-spacing:2px;}
.sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.sdot.live{background:#00ff44;box-shadow:0 0 8px #00ff44;animation:blink 1.5s ease-in-out infinite;}
.sdot.err{background:#ff3300;box-shadow:0 0 8px #ff3300;}
.sdot.fetching{background:#ffaa00;box-shadow:0 0 8px #ffaa00;animation:blink 0.5s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0.2;}}
.stxt{font-size:10px;color:#cc8800;letter-spacing:2px;}
.cbadge{font-family:'Orbitron',monospace;font-size:10px;color:#ff9900;background:#120c00;border:1px solid #2a1800;padding:2px 8px;white-space:nowrap;}
.rbar{height:2px;background:#120c00;}
.rfill{height:100%;background:linear-gradient(90deg,#ff6600,#ffcc00);box-shadow:0 0 8px #ff9900;transition:width 1s linear;}

/* ── Ticker board (replaces scrolling ticker) ── */
.ticker{background:#0d0900;border-bottom:2px solid #1a0f00;overflow:hidden;}
.ticker-hdr{
  display:grid;
  grid-template-columns:120px 1fr 100px 90px 110px 120px;
  padding:5px 24px;
  font-size:8px;color:#332000;letter-spacing:3px;
  background:#080500;
  border-bottom:1px solid #150c00;
}
.ticker-rows{display:flex;flex-direction:column;}
.ticker-row{
  display:grid;
  grid-template-columns:120px 1fr 100px 90px 110px 120px;
  padding:6px 24px;
  border-bottom:1px solid #110900;
  font-size:11px;letter-spacing:1px;align-items:center;
  transition:background 0.15s;
}
.ticker-row:hover{background:#120900;}
.ticker-row:last-child{border-bottom:none;}
.tk-cs{font-family:'Orbitron',monospace;font-weight:700;font-size:11px;color:#ffcc00;}
.tk-route{color:#bb7733;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 12px;}
.tk-route .loading{color:#332000;font-style:italic;}
.tk-alt{color:#ffaa44;text-align:right;}
.tk-spd{color:#997722;text-align:right;}
.tk-hdg{color:#775522;text-align:center;}
.tk-status{text-align:right;font-size:10px;font-weight:bold;letter-spacing:1px;}
.tk-up{color:#44ff88;}
.tk-dn{color:#ff5544;}
.tk-cruise{color:#665522;}
.ticker-empty{padding:8px 24px;font-size:10px;color:#221500;letter-spacing:3px;}

/* ── Board ── */
.bhdr{display:grid;grid-template-columns:1.6fr 2fr 1.4fr 1.1fr 1.2fr 0.9fr 1.3fr;padding:9px 24px;font-size:9px;color:#553300;letter-spacing:3px;border-bottom:1px solid #180e00;background:#0a0700;}
.frow{display:grid;grid-template-columns:1.6fr 2fr 1.4fr 1.1fr 1.2fr 0.9fr 1.3fr;padding:10px 24px;border-bottom:1px solid #110900;cursor:pointer;transition:background 0.15s;position:relative;animation:rowIn 0.3s ease-out;}
@keyframes rowIn{from{opacity:0;transform:translateX(-6px);}to{opacity:1;transform:translateX(0);}}
.frow:hover{background:#160d00;}
.frow.sel{background:#1c1000;border-left:3px solid #ffaa00;}
.frow::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac,transparent);box-shadow:0 0 6px var(--ac,transparent);}
.cell{font-size:13px;color:#ffaa33;display:flex;align-items:center;gap:5px;overflow:hidden;}
.cell.dim{color:#774400;font-size:11px;}
.cell.bright{color:#ffdd55;text-shadow:0 0 12px #ffaa00;}
.cell.grn{color:#44ff88;}
.cell.red{color:#ff5544;}
.cs{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#ffcc00;text-shadow:0 0 10px #ffaa00;letter-spacing:1px;}
.pico{font-size:15px;display:inline-block;transition:transform 0.5s;}
.abar{width:38px;height:3px;background:#160d00;border-radius:2px;overflow:hidden;margin-top:3px;}
.afill{height:100%;border-radius:2px;background:linear-gradient(90deg,#ff6600,#ffcc00);}

/* ── Detail panel ── */
.dpanel{background:#0a0700;border-bottom:2px solid #2a1800;animation:fadeIn 0.2s ease-out;overflow:hidden;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.route-banner{padding:16px 24px 12px;display:flex;align-items:center;gap:0;border-bottom:1px solid #1a0f00;flex-wrap:wrap;}
.route-airport{display:flex;flex-direction:column;min-width:140px;}
.route-iata{font-family:'Orbitron',monospace;font-size:36px;font-weight:900;line-height:1;text-shadow:0 0 20px currentColor;}
.route-iata.origin{color:#44aaff;text-shadow:0 0 20px #44aaff66;}
.route-iata.dest{color:#ff6644;text-shadow:0 0 20px #ff664466;}
.route-city{font-size:11px;margin-top:4px;letter-spacing:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;}
.route-city.origin{color:#3388cc;}
.route-city.dest{color:#cc5533;}
.route-airport-name{font-size:9px;color:#443300;letter-spacing:1px;margin-top:2px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.route-arrow{font-size:28px;color:#664400;padding:0 20px;flex-shrink:0;align-self:center;}
.route-loading{padding:16px 24px;font-size:11px;color:#664400;letter-spacing:3px;border-bottom:1px solid #1a0f00;}
.route-none{padding:12px 24px;font-size:10px;color:#443300;letter-spacing:2px;border-bottom:1px solid #1a0f00;}
.ac-strip{padding:10px 24px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;border-bottom:1px solid #1a0f00;}
.ac-field{display:flex;flex-direction:column;gap:3px;}
.ac-label{font-size:8px;color:#553300;letter-spacing:3px;}
.ac-value{font-family:'Orbitron',monospace;font-size:13px;color:#ffcc44;text-shadow:0 0 8px #ff990044;}
.ac-photo{width:100px;height:60px;object-fit:cover;border:1px solid #2a1800;flex-shrink:0;}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid #1a0f00;}
.stat-cell{padding:10px 16px;border-right:1px solid #1a0f00;}
.stat-cell:last-child{border-right:none;}
.stat-label{font-size:8px;color:#553300;letter-spacing:3px;}
.stat-val{font-family:'Orbitron',monospace;font-size:14px;color:#ffcc44;text-shadow:0 0 8px #ff9900;margin-top:3px;}

/* ── Bottom ── */
.bot{padding:16px 24px;display:flex;gap:24px;align-items:flex-start;border-top:2px solid #180e00;flex-wrap:wrap;}
.rlabel{font-size:9px;color:#553300;letter-spacing:2px;margin-bottom:6px;font-family:'Orbitron',monospace;}
.radar{width:200px;height:200px;flex-shrink:0;}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1;min-width:240px;}
.scard{background:#0d0900;border:1px solid #2a1800;padding:10px 14px;}
.snum{font-family:'Orbitron',monospace;font-size:26px;font-weight:900;color:#ffcc00;text-shadow:0 0 20px #ff9900;line-height:1;}
.slbl{font-size:8px;color:#553300;letter-spacing:3px;margin-top:3px;}

.empty{padding:50px 24px;text-align:center;color:#332200;font-size:13px;letter-spacing:3px;}
.ldots span{animation:ld 1.2s ease-in-out infinite;color:#ff9900;}
.ldots span:nth-child(2){animation-delay:0.2s;}
.ldots span:nth-child(3){animation-delay:0.4s;}
@keyframes ld{0%,80%,100%{opacity:0.2;}40%{opacity:1;}}
.errbanner{padding:6px 24px;font-size:10px;color:#ff6600;background:#100500;letter-spacing:1px;border-bottom:1px solid #300000;}
.foot{padding:8px 24px;font-size:9px;color:#332200;letter-spacing:2px;}
.foot a{color:#553300;text-decoration:none;}
.foot a:hover{color:#ff9900;}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:#080600;}
::-webkit-scrollbar-thumb{background:#2a1800;}

@media(max-width:700px){
  .bhdr,.frow{grid-template-columns:2fr 2fr 1.5fr 1.2fr;}
  .bhdr span:nth-child(n+5),.frow .cell:nth-child(n+5){display:none;}
  .ticker-hdr,.ticker-row{grid-template-columns:100px 1fr 90px 90px;}
  .ticker-hdr span:nth-child(n+5),.ticker-row>*:nth-child(n+5){display:none;}
  .stats-grid{grid-template-columns:1fr 1fr;}
  .stat-cell:nth-child(3){border-top:1px solid #1a0f00;}
}
`;

// ─── Ticker Board component ───────────────────────────────────────────────────

function TickerBoard({ flights, routeCache }) {
  if (!flights.length) {
    return (
      <div className="ticker">
        <div className="ticker-empty">NO AIRCRAFT IN RANGE · WAITING FOR DATA...</div>
      </div>
    );
  }

  return (
    <div className="ticker">
      <div className="ticker-hdr">
        <span>FLIGHT</span>
        <span style={{paddingLeft:12}}>ROUTE / AIRCRAFT</span>
        <span style={{textAlign:"right"}}>ALTITUDE</span>
        <span style={{textAlign:"right"}}>SPEED</span>
        <span style={{textAlign:"center"}}>HEADING</span>
        <span style={{textAlign:"right"}}>STATUS</span>
      </div>
      <div className="ticker-rows">
        {flights.slice(0, 8).map(f => {
          const vrFpm    = f.vrate ? Math.round(f.vrate) : 0;
          const isUp     = vrFpm >  200;
          const isDn     = vrFpm < -200;
          const statusCls= isUp ? "tk-status tk-up" : isDn ? "tk-status tk-dn" : "tk-status tk-cruise";
          const statusTxt= isUp ? "▲ CLIMBING" : isDn ? "▼ DESCENDING" : "→ CRUISING";

          // Pull route from cache
          const cached = f.callsign ? routeCache[f.callsign] : undefined;
          let routeDisp = "";
          if (cached === undefined && f.callsign) {
            routeDisp = "···";
          } else if (cached?.route?.origin && cached?.route?.destination) {
            const o = cached.route.origin.city      || cached.route.origin.iata;
            const d = cached.route.destination.city || cached.route.destination.iata;
            routeDisp = `${o.toUpperCase()} → ${d.toUpperCase()}`;
          } else if (cached?.aircraft?.type) {
            routeDisp = cached.aircraft.type.toUpperCase();
          } else if (f.type) {
            routeDisp = f.type;
          } else {
            routeDisp = getAirline(f.callsign);
          }

          return (
            <div className="ticker-row" key={f.icao}>
              <div className="tk-cs">{f.callsign || f.icao.toUpperCase()}</div>
              <div className="tk-route">{routeDisp}</div>
              <div className="tk-alt">{feetAlt(f.alt)} FT</div>
              <div className="tk-spd">{fmtSpd(f.speed)} KTS</div>
              <div className="tk-hdg">{getHeading(f.track)} {f.track ? Math.round(f.track)+"°" : ""}</div>
              <div className={statusCls}>{statusTxt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────────────────────────────

function Landing({ onSubmit }) {
  const [zip, setZip]   = useState("");
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) { setErr("Enter a valid 5-digit US zip code"); return; }
    setBusy(true); setErr("");
    try {
      const res  = await fetch(`/api/zip?zip=${z}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid zip code");
      onSubmit({ zip: z, ...data });
    } catch(e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="landing">
      <div>
        <div className="brand"><span className="brand-plane">✈</span>FLYBY<span style={{color:"#ff6600"}}>.LIVE</span></div>
        <div className="tagline">LIVE FLIGHTS OVERHEAD · ENTER YOUR ZIP CODE</div>
      </div>
      <form className="zip-form" onSubmit={handleSubmit}>
        <input className="zip-input" type="text" inputMode="numeric" maxLength={5}
          placeholder="07073" value={zip}
          onChange={e=>{setZip(e.target.value.replace(/\D/,""));setErr("");}} autoFocus/>
        <button className="zip-btn" type="submit" disabled={busy}>{busy?"...":"TRACK ▶"}</button>
      </form>
      {err && <div className="zip-error">⚠ {err}</div>}
      <div className="features">
        <div className="feat"><span className="feat-icon">📡</span>LIVE ADS-B DATA</div>
        <div className="feat"><span className="feat-icon">✈</span>ORIGIN & DESTINATION</div>
        <div className="feat"><span className="feat-icon">🛩</span>AIRCRAFT TYPE</div>
        <div className="feat"><span className="feat-icon">🆓</span>100% FREE</div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ flight }) {
  const [info,    setInfo]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setInfo(null); setLoading(true);
    const params = new URLSearchParams();
    if (flight.callsign) params.set("callsign", flight.callsign);
    if (flight.icao)     params.set("icao",     flight.icao);
    fetch(`/api/route?${params}`)
      .then(r => r.json())
      .then(d => { setInfo(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [flight.icao]);

  const spd    = fmtSpd(flight.speed);
  const hdg    = getHeading(flight.track);
  const vrFpm  = flight.vrate ? Math.round(flight.vrate) : 0;
  const vrDisp = vrFpm > 50 ? `▲ ${vrFpm} FPM` : vrFpm < -50 ? `▼ ${Math.abs(vrFpm)} FPM` : "LEVEL";
  const route  = info?.route;
  const ac     = info?.aircraft;

  return (
    <div className="dpanel">
      {loading && <div className="route-loading"><span style={{color:"#ff9900"}}>●</span> LOOKING UP ROUTE & AIRCRAFT...</div>}
      {!loading && !route && <div className="route-none">✈ ROUTE DATA NOT AVAILABLE FOR THIS FLIGHT</div>}
      {!loading && route?.origin && route?.destination && (
        <div className="route-banner">
          <div className="route-airport">
            <div className="route-iata origin">{route.origin.iata || route.origin.icao}</div>
            <div className="route-city origin">{route.origin.city}{route.origin.country !== "United States" ? `, ${route.origin.country}` : ""}</div>
            <div className="route-airport-name">{route.origin.name}</div>
          </div>
          <div className="route-arrow">→</div>
          <div className="route-airport">
            <div className="route-iata dest">{route.destination.iata || route.destination.icao}</div>
            <div className="route-city dest">{route.destination.city}{route.destination.country !== "United States" ? `, ${route.destination.country}` : ""}</div>
            <div className="route-airport-name">{route.destination.name}</div>
          </div>
          {route.airline && (
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div className="ac-label">OPERATED BY</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:"#ffaa44",marginTop:3}}>{route.airline.toUpperCase()}</div>
            </div>
          )}
        </div>
      )}
      {!loading && ac && (
        <div className="ac-strip">
          {ac.photoUrl && <img className="ac-photo" src={ac.photoUrl} alt={ac.type} onError={e=>e.target.style.display="none"}/>}
          {ac.type         && <div className="ac-field"><div className="ac-label">AIRCRAFT TYPE</div><div className="ac-value">{ac.type.toUpperCase()}</div></div>}
          {ac.icaoType     && <div className="ac-field"><div className="ac-label">ICAO TYPE</div><div className="ac-value">{ac.icaoType}</div></div>}
          {ac.manufacturer && <div className="ac-field"><div className="ac-label">MANUFACTURER</div><div className="ac-value">{ac.manufacturer.toUpperCase()}</div></div>}
          {ac.registration && <div className="ac-field"><div className="ac-label">REGISTRATION</div><div className="ac-value">{ac.registration}</div></div>}
          {ac.owner        && <div className="ac-field"><div className="ac-label">OWNER</div><div className="ac-value" style={{fontSize:11}}>{ac.owner.toUpperCase()}</div></div>}
        </div>
      )}
      <div className="stats-grid">
        <div className="stat-cell"><div className="stat-label">ALTITUDE</div><div className="stat-val">{feetAlt(flight.alt)} FT</div></div>
        <div className="stat-cell"><div className="stat-label">GROUND SPEED</div><div className="stat-val">{spd} KTS</div></div>
        <div className="stat-cell"><div className="stat-label">HEADING</div><div className="stat-val">{flight.track?Math.round(flight.track)+"° ":""}{hdg}</div></div>
        <div className="stat-cell"><div className="stat-label">VERT RATE</div><div className="stat-val" style={{color:vrFpm>50?"#44ff88":vrFpm<-50?"#ff5544":"#ffcc44"}}>{vrDisp}</div></div>
        <div className="stat-cell"><div className="stat-label">SQUAWK</div><div className="stat-val">{flight.squawk||"----"}</div></div>
        <div className="stat-cell"><div className="stat-label">ICAO HEX</div><div className="stat-val">{flight.icao.toUpperCase()}</div></div>
        <div className="stat-cell"><div className="stat-label">POSITION</div><div className="stat-val" style={{fontSize:11}}>{flight.lat.toFixed(3)}°N {Math.abs(flight.lon).toFixed(3)}°W</div></div>
        <div className="stat-cell"><div className="stat-label">DISTANCE</div><div className="stat-val">{flight.miles.toFixed(1)} MI</div></div>
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

function Board({ location, onReset }) {
  const [flights,    setFlights]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fetching,   setFetching]   = useState(false);
  const [error,      setError]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [clock,      setClock]      = useState(new Date());
  const [rpct,       setRpct]       = useState(0);
  const [routeCache, setRouteCache] = useState({});
  const countRef = useRef(0);
  const DIST_NM  = 25;
  const INTERVAL = 30;

  const fetchFlights = useCallback(async () => {
    setFetching(true);
    try {
      const res  = await fetch(`/api/flights?lat=${location.lat}&lon=${location.lon}&dist=${DIST_NM}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const ac   = data.ac || [];
      const parsed = ac
        .filter(a => a.lat != null && a.lon != null)
        .map(a => ({
          icao:    (a.hex||"??????").toLowerCase(),
          callsign:(a.flight||"").trim(),
          type:    a.t||"",
          lat:     parseFloat(a.lat), lon: parseFloat(a.lon),
          alt:     a.alt_baro ?? a.alt_geom ?? null,
          speed:   a.gs ?? null, track: a.track ?? null,
          vrate:   a.baro_rate ?? a.geom_rate ?? null,
          squawk:  a.squawk||"",
          miles:   haversine(location.lat, location.lon, parseFloat(a.lat), parseFloat(a.lon)),
        }))
        .filter(f => f.alt !== "ground" && f.alt > 0)
        .sort((a,b) => a.miles - b.miles)
        .slice(0, 25);
      setFlights(parsed);
      setLastUpdate(new Date());
      setError(null);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); setFetching(false); }
  }, [location]);

  // Fetch routes for ticker board flights in background
  useEffect(() => {
    flights.slice(0, 8).forEach(f => {
      if (!f.callsign) return;
      if (routeCache[f.callsign] !== undefined) return; // already fetched
      setRouteCache(c => ({ ...c, [f.callsign]: null })); // mark loading
      const params = new URLSearchParams({ callsign: f.callsign, icao: f.icao });
      fetch(`/api/route?${params}`)
        .then(r => r.json())
        .then(d => setRouteCache(c => ({ ...c, [f.callsign]: d })))
        .catch(() => setRouteCache(c => ({ ...c, [f.callsign]: {} })));
    });
  }, [flights]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchFlights();
    countRef.current = 0; setRpct(0);
    const bar = setInterval(() => {
      countRef.current += 1;
      setRpct((countRef.current / INTERVAL) * 100);
      if (countRef.current >= INTERVAL) { countRef.current = 0; fetchFlights(); }
    }, 1000);
    return () => clearInterval(bar);
  }, [fetchFlights]);

  const avgAlt = flights.length ? Math.round(flights.reduce((s,f)=>s+(f.alt||0),0)/flights.length/1000) : 0;
  const maxSpd = flights.length ? Math.max(...flights.map(f=>fmtSpd(f.speed))) : 0;
  const fmtC   = d => d.toLocaleTimeString("en-US",{hour12:false});
  const dotClass  = fetching?"sdot fetching":error?"sdot err":"sdot live";
  const statusTxt = fetching?"UPDATING...":error?"ERROR":"LIVE";

  return (
    <div className="wall">
      <div className="hdr">
        <div className="hdr-left">
          <div className="logo" onClick={onReset}>✈ FLYBY.LIVE</div>
          <div><div className="location-badge">{location.city.toUpperCase()}, {location.state} · ZIP {location.zip} · {DIST_NM}NM RADIUS</div></div>
          <button className="change-zip" onClick={onReset}>CHANGE ZIP</button>
        </div>
        <div className="hdr-right">
          <div className="clock">{fmtC(clock)}</div>
          <div className={dotClass}/>
          <span className="stxt">{statusTxt}</span>
          <span className="cbadge">{flights.length} AIRCRAFT</span>
        </div>
      </div>

      <div className="rbar"><div className="rfill" style={{width:`${rpct}%`}}/></div>
      {error && <div className="errbanner">⚠ {error}</div>}

      {/* ── Ticker board ── */}
      <TickerBoard flights={flights} routeCache={routeCache} />

      <div className="bhdr">
        <span>CALLSIGN</span><span>AIRLINE / TYPE</span><span>ALT (FT)</span>
        <span>SPEED</span><span>HEADING</span><span>DIST</span><span>VERT RATE</span>
      </div>

      <div>
        {loading && (
          <div className="empty">
            <div className="ldots">SCANNING<span>.</span><span>.</span><span>.</span></div>
            <div style={{marginTop:12,fontSize:10,color:"#442200"}}>LIVE AIRCRAFT OVER {location.city.toUpperCase()}, {location.state}</div>
          </div>
        )}
        {!loading && flights.length===0 && !error && (
          <div className="empty">NO AIRBORNE AIRCRAFT IN RANGE RIGHT NOW</div>
        )}
        {flights.map(f => {
          const spd    = fmtSpd(f.speed);
          const hdg    = getHeading(f.track);
          const altPct = Math.min(100,((f.alt||0)/40000)*100);
          const isSel  = selected===f.icao;
          const ac     = ACCENT[(f.callsign||"").slice(0,3).toUpperCase()]||"#ff6600";
          const vrFpm  = f.vrate ? Math.round(f.vrate) : 0;
          const vrLbl  = vrFpm>50?`▲ ${vrFpm}`:vrFpm<-50?`▼ ${Math.abs(vrFpm)}`:"LEVEL";
          const vrCls  = vrFpm>50?"cell grn":vrFpm<-50?"cell red":"cell dim";
          return (
            <div key={f.icao}>
              <div className={`frow${isSel?" sel":""}`} style={{"--ac":ac}} onClick={()=>setSelected(isSel?null:f.icao)}>
                <div className="cell">
                  <span className="pico" style={{transform:`rotate(${f.track||0}deg)`}}>✈</span>
                  <span className="cs">{f.callsign||f.icao}</span>
                </div>
                <div className="cell" style={{fontSize:12}}>
                  {getAirline(f.callsign)}
                  {f.type&&<span className="dim" style={{fontSize:10}}> · {f.type}</span>}
                </div>
                <div className="cell" style={{flexDirection:"column",alignItems:"flex-start",gap:2}}>
                  <span className="bright">{feetAlt(f.alt)}</span>
                  <div className="abar"><div className="afill" style={{width:`${altPct}%`}}/></div>
                </div>
                <div className="cell bright">{spd}<span className="dim" style={{fontSize:10,marginLeft:2}}>KTS</span></div>
                <div className="cell">{hdg}<span className="dim" style={{fontSize:10,marginLeft:3}}>{f.track?Math.round(f.track)+"°":""}</span></div>
                <div className="cell dim">{f.miles.toFixed(1)}<span style={{fontSize:10,marginLeft:2}}>MI</span></div>
                <div className={vrCls}>{vrLbl}<span style={{fontSize:10,marginLeft:2}}>FPM</span></div>
              </div>
              {isSel && <DetailPanel flight={f}/>}
            </div>
          );
        })}
      </div>

      {!loading && flights.length > 0 && (
        <div className="bot">
          <div>
            <div className="rlabel">RADAR · {DIST_NM}NM</div>
            <svg className="radar" viewBox="0 0 200 200">
              {[1,2,3].map(r=>(
                <circle key={r} cx="100" cy="100" r={r*28} fill="none" stroke="#180e00" strokeWidth="1"/>
              ))}
              <line x1="100" y1="16" x2="100" y2="184" stroke="#180e00" strokeWidth="1"/>
              <line x1="16"  y1="100" x2="184" y2="100" stroke="#180e00" strokeWidth="1"/>
              <line x1="100" y1="100" x2="100" y2="16" stroke="#ff8800" strokeWidth="1.5" opacity="0.5">
                <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="4s" repeatCount="indefinite"/>
              </line>
              <circle cx="100" cy="100" r="4" fill="#ff9900"/>
              <circle cx="100" cy="100" r="4" fill="none" stroke="#ff9900" strokeWidth="1" opacity="0.4">
                <animate attributeName="r" from="4" to="16" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
              </circle>
              {flights.map(f=>{
                const scale=84/DIST_NM, nmPerDeg=60;
                const cx=100+(f.lon-location.lon)*nmPerDeg*scale;
                const cy=100-(f.lat-location.lat)*nmPerDeg*scale;
                if(cx<4||cx>196||cy<4||cy>196) return null;
                return (
                  <g key={f.icao} onClick={()=>setSelected(selected===f.icao?null:f.icao)} style={{cursor:"pointer"}}>
                    <circle cx={cx} cy={cy} r={selected===f.icao?4:2.5}
                      fill={selected===f.icao?"#ffdd00":"#ff9900"}
                      style={{filter:"drop-shadow(0 0 3px #ff9900)"}}/>
                    {selected===f.icao&&(
                      <text x={cx+5} y={cy-3} fontSize="7" fill="#ffcc00" fontFamily="Share Tech Mono">{f.callsign}</text>
                    )}
                  </g>
                );
              })}
              <text x="103" y="15"  fontSize="7" fill="#442200" fontFamily="Share Tech Mono">N</text>
              <text x="103" y="196" fontSize="7" fill="#442200" fontFamily="Share Tech Mono">S</text>
              <text x="12"  y="103" fontSize="7" fill="#442200" fontFamily="Share Tech Mono">W</text>
              <text x="186" y="103" fontSize="7" fill="#442200" fontFamily="Share Tech Mono">E</text>
            </svg>
          </div>
          <div className="sgrid">
            <div className="scard"><div className="snum">{flights.length}</div><div className="slbl">AIRCRAFT IN RANGE</div></div>
            <div className="scard"><div className="snum">{maxSpd}</div><div className="slbl">TOP SPEED (KTS)</div></div>
            <div className="scard"><div className="snum">{avgAlt}K</div><div className="slbl">AVG ALTITUDE (FT)</div></div>
            <div className="scard"><div className="snum">{flights[0]?.miles.toFixed(1)||"--"}</div><div className="slbl">CLOSEST (MI)</div></div>
          </div>
        </div>
      )}

      {lastUpdate && (
        <div className="foot">
          LAST UPDATE {lastUpdate.toLocaleTimeString()} · AUTO-REFRESH {INTERVAL}S ·
          DATA: <a href="https://adsb.lol" target="_blank" rel="noopener noreferrer">ADSB.LOL</a> ·
          ROUTES: <a href="https://adsbdb.com" target="_blank" rel="noopener noreferrer">ADSBDB.COM</a>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [location, setLocation] = useState(null);
  return (
    <>
      <style>{CSS}</style>
      <div className="scanlines"/>
      <div className="vignette"/>
      {location
        ? <Board location={location} onReset={()=>setLocation(null)}/>
        : <Landing onSubmit={setLocation}/>
      }
    </>
  );
}
