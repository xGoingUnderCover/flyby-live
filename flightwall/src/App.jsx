import { useState, useEffect, useCallback, useRef } from "react";

const AIRLINE_MAP = {
  UAL:"UNITED",DAL:"DELTA",AAL:"AMERICAN",SWA:"SOUTHWEST",JBU:"JETBLUE",
  NKS:"SPIRIT",FFT:"FRONTIER",ASA:"ALASKA",FDX:"FEDEX",UPS:"UPS AIR",
  WJA:"WESTJET",ACA:"AIR CANADA",BAW:"BRIT AIR",DLH:"LUFTHANSA",
  AFR:"AIR FRANCE",KLM:"KLM",IBE:"IBERIA",UAE:"EMIRATES",QTR:"QATAR",
  THY:"TURKISH",VIR:"VIRGIN ATL",EIN:"AER LINGUS",CLX:"CARGOLUX",
  ENY:"ENVOY",SKW:"SKYWEST",RPA:"REPUBLIC",CPZ:"COLGAN",
};
const getAirline = (flight, routeAirline) => {
  if (routeAirline) return routeAirline.toUpperCase().slice(0,14);
  if (!flight) return "UNKNOWN";
  const code = flight.slice(0,3).toUpperCase();
  return AIRLINE_MAP[code] || flight.trim().toUpperCase().slice(0,10);
};
const getHeading = (track) => {
  if (track == null) return "---";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(track/22.5)%16];
};
const feetAlt = (ft) => ft != null && ft !== "ground" && !isNaN(ft) ? Math.round(ft).toLocaleString() : "----";
const fmtSpd  = (kts) => kts != null ? Math.round(kts) : 0;
const haversine = (lat1,lon1,lat2,lon2) => {
  const R=3958.8,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};
// Major airport coordinates for flight time estimation
// adsbdb returns city/iata but not lat/lon, so we use this lookup
const AP_COORDS = {
  ATL:[33.6407,-84.4277],BOS:[42.3656,-71.0096],CLT:[35.2140,-80.9431],
  DEN:[39.8561,-104.6737],DFW:[32.8998,-97.0403],DTW:[42.2124,-83.3534],
  EWR:[40.6925,-74.1687],FLL:[26.0742,-80.1506],HNL:[21.3187,-157.9224],
  IAD:[38.9531,-77.4565],IAH:[29.9902,-95.3368],JFK:[40.6413,-73.7781],
  LAS:[36.0840,-115.1537],LAX:[33.9425,-118.4081],LGA:[40.7773,-73.8726],
  MCO:[28.4312,-81.3081],MDW:[41.7868,-87.7522],MIA:[25.7959,-80.2870],
  MSP:[44.8848,-93.2223],ORD:[41.9742,-87.9073],PHL:[39.8721,-75.2437],
  PHX:[33.4373,-112.0078],PVD:[41.7251,-71.4284],SEA:[47.4502,-122.3088],
  SFO:[37.6213,-122.3790],SLC:[40.7884,-111.9778],TEB:[40.8501,-74.0608],
  BOS:[42.3656,-71.0096],BDL:[41.9389,-72.6832],MHT:[42.9326,-71.4357],
  PBI:[26.6832,-80.0956],TPA:[27.9755,-82.5332],STL:[38.7487,-90.3700],
  MSY:[29.9934,-90.2580],BNA:[36.1245,-86.6782],AUS:[30.1975,-97.6664],
  CUN:[21.0365,-86.8771],MEX:[19.4363,-99.0721],LHR:[51.4775,-0.4614],
  CDG:[49.0097,2.5479],FRA:[50.0379,8.5622],AMS:[52.3086,4.7639],
  MAD:[40.4719,-3.5626],BCN:[41.2971,2.0785],FCO:[41.8003,12.2389],
  YYZ:[43.6777,-79.6248],YUL:[45.4706,-73.7408],GRU:[-23.4356,-46.4731],
  NRT:[35.7653,140.3856],ICN:[37.4602,126.4407],SYD:[-33.9399,151.1753],
  DUB:[53.4213,-6.2701],MAN:[53.3537,-2.2750],ORF:[36.8976,-76.0183],
};

const estDuration = (route) => {
  if (!route?.origin?.iata || !route?.destination?.iata) return null;
  const oc = AP_COORDS[route.origin.iata];
  const dc = AP_COORDS[route.destination.iata];
  if (!oc || !dc) return null;
  const d = haversine(oc[0],oc[1],dc[0],dc[1]);
  if (!d || d < 30) return null;
  // Use 480mph cruise but add 20min for taxi/climb/descent
  const hrs = d/480 + (20/60);
  if (hrs < 1) return `~${Math.round(hrs*60)}MIN`;
  return `~${Math.floor(hrs)}H${Math.round((hrs%1)*60).toString().padStart(2,"0")}M`;
};
const ACCENT = {
  UAL:"#1a44bb",DAL:"#cc0022",AAL:"#0066cc",SWA:"#dd8800",
  JBU:"#0055aa",FDX:"#8800cc",UPS:"#5c3317",NKS:"#ccbb00"
};
const accentFor = (cs) => ACCENT[(cs||"").slice(0,3).toUpperCase()] || "#ff6600";

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#080600;font-family:'Share Tech Mono',monospace;color:#ff9900;}
.scanlines{position:fixed;inset:0;pointer-events:none;z-index:300;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);}
.vignette{position:fixed;inset:0;pointer-events:none;z-index:299;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,0.55) 100%);}

/* ── Landing ── */
.landing{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;}
.brand{font-family:'Orbitron',monospace;font-weight:900;font-size:clamp(36px,8vw,80px);color:#ffb300;text-shadow:0 0 30px #ff9900,0 0 60px #ff6600;letter-spacing:6px;line-height:1;animation:glow 3s ease-in-out infinite;}
@keyframes glow{0%,100%{text-shadow:0 0 30px #ff9900,0 0 60px #ff6600;}50%{text-shadow:0 0 40px #ffcc00,0 0 80px #ff8800;}}
.brand-plane{font-size:clamp(28px,5vw,56px);margin-right:12px;display:inline-block;animation:flyIn 1.2s ease-out;}
@keyframes flyIn{from{transform:translateX(-80px);opacity:0;}to{transform:translateX(0);opacity:1;}}
.tagline{font-size:clamp(12px,2vw,16px);color:#aa6600;letter-spacing:4px;margin-top:12px;margin-bottom:48px;}
.zip-form{display:flex;width:100%;max-width:380px;}
.zip-input{flex:1;background:#0f0900;border:2px solid #3a2200;border-right:none;color:#ffcc00;font-family:'Orbitron',monospace;font-size:22px;font-weight:700;letter-spacing:6px;padding:14px 16px;outline:none;text-align:center;transition:border-color 0.2s;}
.zip-input::placeholder{color:#3a2200;}
.zip-input:focus{border-color:#ff9900;}
.zip-btn{background:#ff8800;border:2px solid #ff8800;color:#000;font-family:'Orbitron',monospace;font-size:13px;font-weight:900;letter-spacing:2px;padding:14px 20px;cursor:pointer;transition:background 0.15s;white-space:nowrap;}
.zip-btn:hover{background:#ffaa00;}
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

/* ── Airport filter tabs ── */
.ap-filter-bar{
  padding:6px 24px;background:#0a0700;border-bottom:1px solid #1a0f00;
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;
}
.ap-filter-label{font-size:8px;color:#443300;letter-spacing:3px;margin-right:4px;white-space:nowrap;}
.ap-tab{
  background:none;border:1px solid #2a1800;color:#664400;
  font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;
  padding:3px 10px;cursor:pointer;transition:all 0.15s;white-space:nowrap;
}
.ap-tab:hover{border-color:#ff9900;color:#ff9900;}
.ap-tab.active{background:#1a0f00;border-color:#ff8800;color:#ffaa00;box-shadow:0 0 6px #ff880033;}
.ap-tab.all{border-color:#3a2800;color:#885500;}
.ap-tab.all.active{border-color:#ffcc00;color:#ffcc00;background:#1a1000;}

/* ── Ticker board ── */
.ticker{background:#0c0800;border-bottom:2px solid #1a0f00;overflow-x:auto;}
.ticker-hdr{
  display:grid;
  grid-template-columns:150px 110px 140px 100px 60px 110px 110px 90px 80px 90px 70px 90px;
  padding:5px 16px;min-width:1220px;
  font-size:8px;color:#332000;letter-spacing:3px;
  background:#080500;border-bottom:1px solid #150c00;
}
.ticker-row{
  display:grid;
  grid-template-columns:150px 110px 140px 100px 60px 110px 110px 90px 80px 90px 70px 90px;
  padding:7px 16px;min-width:1220px;
  border-bottom:1px solid #110900;
  font-size:11px;letter-spacing:1px;align-items:center;
  position:relative;transition:background 0.15s;
  animation:rowIn 0.3s ease-out;
}
@keyframes rowIn{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}
.ticker-row:hover{background:#120900;}
.ticker-row.sel{background:#1c1000;border-left:3px solid #ffaa00;}
.ticker-row{cursor:pointer;}
.ticker-row:last-child{border-bottom:none;}
.ticker-row::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac,#ff6600);box-shadow:0 0 5px var(--ac,#ff6600);}
.ticker-empty{padding:10px 16px;font-size:10px;color:#221500;letter-spacing:3px;min-width:1220px;}
.tk-cs{font-family:'Orbitron',monospace;font-weight:900;font-size:11px;color:#ffcc00;text-shadow:0 0 8px #ffaa0055;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tk-airline{color:#cc8844;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;}
.tk-ac{color:#664400;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tk-route{display:flex;align-items:center;gap:4px;overflow:hidden;}
.tk-iata{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;}
.tk-iata.orig{color:#44aaff;}
.tk-iata.dest{color:#ff6644;}
.tk-arrow{color:#554400;font-size:10px;}
.tk-dur{font-size:9px;color:#443300;margin-left:2px;}
.tk-num{color:#ffaa44;font-size:11px;text-align:right;padding-right:8px;}
.tk-hdg{color:#886633;font-size:11px;text-align:center;}
.tk-alt{color:#ffaa33;font-size:11px;text-align:right;padding-right:8px;}
.tk-status{font-size:10px;font-weight:bold;letter-spacing:1px;text-align:center;}
.tk-dep{color:#44ff88;text-shadow:0 0 6px #44ff8844;}
.tk-arr{color:#ff5544;text-shadow:0 0 6px #ff554444;}
.tk-pat{color:#665522;}

/* ── Middle section: radar map + flight list ── */
.mid-section{
  display:grid;
  grid-template-columns:50% 50%;
  border-bottom:2px solid #1a0f00;
  min-height:220px;
}
.map-panel{
  border-right:1px solid #1a0f00;
  display:flex;flex-direction:column;
  background:#090700;
  overflow:hidden;
}
.map-title{
  font-size:8px;color:#443300;letter-spacing:3px;
  font-family:'Orbitron',monospace;
  padding:8px 14px 6px;
  background:#090700;
  border-bottom:1px solid #1a0f00;
  flex-shrink:0;
}
.map-container{
  flex:1;
  min-height:210px;
  position:relative;
}
/* Override Leaflet styles to match dark theme */
.leaflet-container{background:#0a0800 !important;}
.leaflet-tile{filter:invert(1) hue-rotate(180deg) saturate(0.4) brightness(0.5);}
.leaflet-control-attribution{display:none !important;}
.leaflet-control-zoom a{
  background:#0d0900 !important;border-color:#2a1800 !important;
  color:#ff9900 !important;font-weight:bold;
}
.leaflet-control-zoom a:hover{background:#1a0f00 !important;}
.leaflet-popup-content-wrapper{
  background:#0d0900;border:1px solid #2a1800;color:#ff9900;
  font-family:'Share Tech Mono',monospace;font-size:11px;
  border-radius:0;box-shadow:0 0 12px #ff880033;
}
.leaflet-popup-tip{background:#0d0900;}
.leaflet-popup-close-button{color:#ff6600 !important;}

/* ── Flight board ── */
.bhdr{display:grid;grid-template-columns:110px 140px 110px 110px 90px 80px 90px 70px 90px;padding:8px 20px;font-size:9px;color:#553300;letter-spacing:3px;border-bottom:1px solid #180e00;background:#0a0700;min-width:900px;overflow-x:auto;}
.frow{display:grid;grid-template-columns:110px 140px 110px 110px 90px 80px 90px 70px 90px;padding:9px 20px;border-bottom:1px solid #110900;cursor:pointer;transition:background 0.15s;position:relative;animation:rowIn 0.3s ease-out;min-width:900px;}
.frow:hover{background:#160d00;}
.frow.sel{background:#1c1000;border-left:3px solid #ffaa00;}
.frow::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac,transparent);box-shadow:0 0 6px var(--ac,transparent);}
.cell{font-size:12px;color:#ffaa33;display:flex;align-items:center;gap:5px;overflow:hidden;}
.cell.dim{color:#774400;font-size:10px;}
.cell.bright{color:#ffdd55;text-shadow:0 0 12px #ffaa00;}
.cell.grn{color:#44ff88;}
.cell.red{color:#ff5544;}
.cs{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#ffcc00;text-shadow:0 0 10px #ffaa00;letter-spacing:1px;}
.pico{font-size:14px;display:inline-block;transition:transform 0.5s;}
.abar{width:34px;height:3px;background:#160d00;border-radius:2px;overflow:hidden;margin-top:3px;}
.afill{height:100%;border-radius:2px;background:linear-gradient(90deg,#ff6600,#ffcc00);}

/* ── Detail panel ── */
.dpanel{background:#0a0700;border-bottom:2px solid #2a1800;animation:fadeIn 0.2s ease-out;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.route-banner{padding:14px 20px 10px;display:flex;align-items:center;gap:0;border-bottom:1px solid #1a0f00;flex-wrap:wrap;}
.route-airport{display:flex;flex-direction:column;min-width:120px;}
.route-iata{font-family:'Orbitron',monospace;font-size:32px;font-weight:900;line-height:1;}
.route-iata.origin{color:#44aaff;text-shadow:0 0 16px #44aaff55;}
.route-iata.dest{color:#ff6644;text-shadow:0 0 16px #ff664455;}
.route-city{font-size:10px;margin-top:3px;letter-spacing:2px;color:#666;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.route-city.origin{color:#3388cc;}
.route-city.dest{color:#cc5533;}
.route-airport-name{font-size:8px;color:#443300;letter-spacing:1px;margin-top:2px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.route-arrow{font-size:24px;color:#664400;padding:0 16px;flex-shrink:0;align-self:center;}
.route-loading{padding:14px 20px;font-size:11px;color:#664400;letter-spacing:3px;border-bottom:1px solid #1a0f00;}
.route-none{padding:10px 20px;font-size:10px;color:#443300;letter-spacing:2px;border-bottom:1px solid #1a0f00;}
.ac-strip{padding:8px 20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;border-bottom:1px solid #1a0f00;}
.ac-field{display:flex;flex-direction:column;gap:2px;}
.ac-label{font-size:7px;color:#553300;letter-spacing:3px;}
.ac-value{font-family:'Orbitron',monospace;font-size:12px;color:#ffcc44;}
.ac-photo{width:90px;height:54px;object-fit:cover;border:1px solid #2a1800;flex-shrink:0;}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);}
.stat-cell{padding:8px 14px;border-right:1px solid #1a0f00;}
.stat-cell:last-child{border-right:none;}
.stat-label{font-size:7px;color:#553300;letter-spacing:3px;}
.stat-val{font-family:'Orbitron',monospace;font-size:13px;color:#ffcc44;margin-top:2px;}

/* ── Misc ── */
.empty{padding:40px 20px;text-align:center;color:#332200;font-size:12px;letter-spacing:3px;}
.ldots span{animation:ld 1.2s ease-in-out infinite;color:#ff9900;}
.ldots span:nth-child(2){animation-delay:0.2s;}
.ldots span:nth-child(3){animation-delay:0.4s;}
@keyframes ld{0%,80%,100%{opacity:0.2;}40%{opacity:1;}}
.errbanner{padding:5px 20px;font-size:10px;color:#ff6600;background:#100500;letter-spacing:1px;border-bottom:1px solid #300000;}
.foot{padding:6px 20px;font-size:8px;color:#332200;letter-spacing:2px;}
.foot a{color:#553300;text-decoration:none;}
.foot a:hover{color:#ff9900;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:#080600;}
::-webkit-scrollbar-thumb{background:#2a1800;}
@media(max-width:700px){
  .bhdr,.frow{grid-template-columns:2fr 2fr 1.5fr 1.2fr;}
  .bhdr span:nth-child(n+5),.frow .cell:nth-child(n+5){display:none;}
  .mid-section{grid-template-columns:1fr;}
  .map-panel{border-right:none;border-bottom:1px solid #1a0f00;}.map-container{min-height:200px;}
  .stats-grid{grid-template-columns:1fr 1fr;}
}
`;

// ─── Airport filter bar ───────────────────────────────────────────────────────
function AirportFilterBar({ airports, selected, onSelect }) {
  if (!airports || airports.length === 0) return null;
  return (
    <div className="ap-filter-bar">
      <span className="ap-filter-label">FILTER:</span>
      <button
        className={`ap-tab all${!selected ? " active" : ""}`}
        onClick={() => onSelect(null)}
      >
        ALL
      </button>
      {airports.map(ap => (
        <button
          key={ap.iata}
          className={`ap-tab${selected === ap.iata ? " active" : ""}`}
          onClick={() => onSelect(selected === ap.iata ? null : ap.iata)}
          title={`${ap.name} — ${ap.dist} mi away`}
        >
          {ap.iata}
        </button>
      ))}
    </div>
  );
}

// ─── Ticker board ─────────────────────────────────────────────────────────────
function TickerBoard({ flights, routeCache, nearbyIata, nearbyAirports, filterAp, selectedTicker, onTickerSelect }) {
  const hasNearby = nearbyIata && nearbyIata.size > 0;

  const localFlights = flights
    .filter(f => {
      if (!f.alt || f.alt > 18000) return false;
      const vr = f.vrate ? Math.round(f.vrate) : 0;
      if (Math.abs(vr) < 150) return false;
      if (hasNearby) {
        const cached = f.callsign ? routeCache[f.callsign] : null;
        if (!cached) return true;
        const route = cached?.route;
        if (!route) return false;
        // If a specific airport is selected, filter to just that one
        if (filterAp) {
          return route.origin?.iata === filterAp || route.destination?.iata === filterAp;
        }
        return (route.origin?.iata && nearbyIata.has(route.origin.iata)) ||
               (route.destination?.iata && nearbyIata.has(route.destination.iata));
      }
      return true;
    })
    .sort((a, b) => a.miles - b.miles)
    .slice(0, 5);

  const apList = hasNearby ? Array.from(nearbyIata).join(" · ") : "";

  return (
    <div className="ticker">
      <div className="ticker-hdr">
        <span>ROUTE</span>
        <span>CALLSIGN</span>
        <span>AIRLINE</span>
        <span style={{textAlign:"center"}}>STATUS</span>
        <span style={{textAlign:"center"}}>TIME</span>
        <span>MAKER</span>
        <span>AIRCRAFT</span>
        <span style={{textAlign:"right",paddingRight:8}}>ALT (FT)</span>
        <span style={{textAlign:"right",paddingRight:8}}>SPEED</span>
        <span style={{textAlign:"center"}}>HEADING</span>
        <span style={{textAlign:"right",paddingRight:8}}>DIST</span>
        <span style={{textAlign:"center"}}>VERT RATE</span>
      </div>

      {localFlights.length === 0 ? (
        <div className="ticker-empty">
          {flights.length === 0
            ? "SCANNING FOR LOCAL TRAFFIC..."
            : filterAp
              ? `NO FLIGHTS FOR ${filterAp} RIGHT NOW · ${flights.filter(f=>f.alt>18000).length} CRUISING OVERHEAD`
              : `NO LOCAL ARRIVALS OR DEPARTURES · ${flights.filter(f=>f.alt>18000).length} CRUISING OVERHEAD`}
        </div>
      ) : (
        localFlights.map(f => {
          const vrFpm  = f.vrate ? Math.round(f.vrate) : 0;
          const isDep  = vrFpm >  150;
          const isArr  = vrFpm < -150;
          const statusCls = isDep ? "tk-status tk-dep" : isArr ? "tk-status tk-arr" : "tk-status tk-pat";
          const statusTxt = isDep ? "▲ DEPARTING" : isArr ? "▼ ARRIVING" : "→ PATTERN";

          const cached   = f.callsign ? routeCache[f.callsign] : undefined;
          const route    = cached?.route;
          const aircraft = cached?.aircraft;
          const acType   = aircraft?.type || f.type || "—";
          const airline  = getAirline(f.callsign, route?.airline);
          const duration = estDuration(route);
          const accent   = accentFor(f.callsign);
          const isSel   = selectedTicker === f.icao;

          return (
            <div className={`ticker-row${isSel?" sel":""}`} key={f.icao} style={{"--ac": accent}}
                 onClick={() => onTickerSelect(isSel ? null : f.icao)}>
              {/* ROUTE */}
              <div className="tk-route">
                {route?.origin && route?.destination ? (
                  <>
                    <span className="tk-iata orig">{route.origin.iata}</span>
                    <span className="tk-arrow">→</span>
                    <span className="tk-iata dest">{route.destination.iata}</span>
                  </>
                ) : cached === undefined && f.callsign ? (
                  <span style={{color:"#332000"}}>···</span>
                ) : (
                  <span style={{color:"#443300"}}>—</span>
                )}
              </div>
              {/* CALLSIGN */}
              <div className="tk-cs">{f.callsign || f.icao.toUpperCase()}</div>
              {/* AIRLINE */}
              <div className="tk-airline">{cached === undefined && f.callsign ? "···" : airline}</div>
              {/* STATUS */}
              <div className={statusCls}>{statusTxt}</div>
              {/* TIME */}
              <div style={{textAlign:"center",color:"#885500",fontSize:10}}>{duration || "—"}</div>
              {/* MAKER */}
              <div className="tk-ac">{aircraft?.manufacturer?.toUpperCase().slice(0,10) || "—"}</div>
              {/* AIRCRAFT */}
              <div className="tk-ac">{acType}</div>
              {/* ALT */}
              <div className="tk-alt">{feetAlt(f.alt)}</div>
              {/* SPEED */}
              <div className="tk-num">{fmtSpd(f.speed)} <span style={{fontSize:9,color:"#664400"}}>KTS</span></div>
              {/* HEADING */}
              <div className="tk-hdg">{getHeading(f.track)} {f.track ? Math.round(f.track)+"°" : ""}</div>
              {/* DIST */}
              <div className="tk-num" style={{paddingRight:8}}>{f.miles.toFixed(1)} <span style={{fontSize:9,color:"#664400"}}>MI</span></div>
              {/* VERT RATE */}
              <div className={`tk-status ${vrFpm>50?"tk-dep":vrFpm<-50?"tk-arr":"tk-pat"}`}>
                {vrFpm>50?`▲ ${vrFpm}`:vrFpm<-50?`▼ ${Math.abs(vrFpm)}`:"LEVEL"}
              </div>
            </div>
          );
        }).reduce((acc, el, i) => {
          const f = localFlights[i];
          return [...acc, el, selectedTicker === f?.icao ? <DetailPanel key={f.icao+"_dp"} flight={f}/> : null];
        }, [])
      )}
    </div>
  );
}

// ─── Radar + Airport map ──────────────────────────────────────────────────────
function LiveMap({ location, flights, nearbyAirports, selected, onSelect }) {
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const apMarkersRef = useRef([]);

  // Load Leaflet CSS + JS from CDN once
  useEffect(() => {
    if (document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id   = "leaflet-css";
    link.rel  = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.id  = "leaflet-js";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    document.head.appendChild(script);
  }, []);

  // Init map once container is ready
  useEffect(() => {
    const init = () => {
      if (!mapRef.current || leafletRef.current) return;
      if (!window.L) { setTimeout(init, 200); return; }
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [location.lat, location.lon],
        zoom: 10,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 14,
      }).addTo(map);

      // Home pin — user zip location
      const homeIcon = L.divIcon({
        className: "",
        html: `<div style="width:10px;height:10px;background:#ff9900;border:2px solid #ffcc00;border-radius:50%;box-shadow:0 0 10px #ff990088;"></div>`,
        iconSize: [10,10], iconAnchor: [5,5],
      });
      L.marker([location.lat, location.lon], {icon: homeIcon})
        .addTo(map)
        .bindPopup(`<b>${location.city.toUpperCase()}, ${location.state}</b><br>ZIP ${location.zip}`);

      leafletRef.current = map;
    };
    setTimeout(init, 300);
    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, [location]);

  // Airport markers — update when nearbyAirports changes
  useEffect(() => {
    const L = window.L;
    const map = leafletRef.current;
    if (!L || !map) return;

    // Clear old airport markers
    apMarkersRef.current.forEach(m => m.remove());
    apMarkersRef.current = [];

    (nearbyAirports || []).forEach(ap => {
      const isLarge = ap.type === "large_airport";
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:${isLarge?14:10}px;height:${isLarge?14:10}px;
          background:${isLarge?"#ff880033":"#ff660011"};
          border:${isLarge?"2px":"1px"} solid ${isLarge?"#ff8800":"#aa5500"};
          transform:rotate(45deg);
          box-shadow:${isLarge?"0 0 8px #ff880055":""};
          cursor:pointer;
        "></div>`,
        iconSize: [isLarge?14:10, isLarge?14:10],
        iconAnchor: [isLarge?7:5, isLarge?7:5],
      });
      const label = L.divIcon({
        className:"",
        html:`<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:${isLarge?"#ff8800":"#885500"};white-space:nowrap;margin-left:10px;margin-top:-4px;text-shadow:0 0 4px #000;">${ap.iata}</div>`,
        iconSize:[40,14], iconAnchor:[0,7],
      });
      const m = L.marker([ap.lat, ap.lon], {icon})
        .addTo(map)
        .bindPopup(`<b>${ap.iata}</b> — ${ap.name}<br>${ap.city} · ${ap.dist} mi away`)
        .on("click", () => onSelect && onSelect(ap.iata));
      const l = L.marker([ap.lat, ap.lon], {icon: label, interactive: false}).addTo(map);
      apMarkersRef.current.push(m, l);
    });
  }, [nearbyAirports, leafletRef.current]);

  // Flight markers — update on every flights change
  useEffect(() => {
    const L = window.L;
    const map = leafletRef.current;
    if (!L || !map) return;

    // Clear old flight markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    flights.forEach(f => {
      if (!f.lat || !f.lon) return;
      const isLocal = f.alt && f.alt < 18000 && f.vrate && Math.abs(f.vrate) > 150;
      const isDep   = f.vrate && f.vrate > 150;
      const isArr   = f.vrate && f.vrate < -150;
      const color   = selected === f.icao ? "#ffdd00"
                    : isLocal && isDep     ? "#44ff88"
                    : isLocal && isArr     ? "#ff5544"
                    : "#ff9900";
      const size    = isLocal ? 12 : 8;
      const rotation = f.track || 0;

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          font-size:${size}px;
          color:${color};
          transform:rotate(${rotation}deg);
          text-shadow:0 0 6px ${color}88;
          line-height:1;
          cursor:pointer;
        ">✈</div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });

      const popup = `
        <b>${f.callsign || f.icao.toUpperCase()}</b><br>
        ${feetAlt(f.alt)} FT · ${fmtSpd(f.speed)} KTS<br>
        ${getHeading(f.track)} ${f.track ? Math.round(f.track)+"°" : ""}
        ${isLocal ? `<br><span style="color:${color}">${isDep?"▲ DEPARTING":"▼ ARRIVING"}</span>` : ""}
      `;

      const m = L.marker([f.lat, f.lon], {icon})
        .addTo(map)
        .bindPopup(popup);
      markersRef.current.push(m);
    });
  }, [flights, selected]);

  return (
    <div className="map-panel">
      <div className="map-title">LIVE MAP · {(nearbyAirports||[]).length} AIRPORTS · {flights.length} AIRCRAFT</div>
      <div className="map-container" ref={mapRef}/>
    </div>
  );
}


// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ flight }) {
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setInfo(null); setLoading(true);
    const p = new URLSearchParams();
    if (flight.callsign) p.set("callsign", flight.callsign);
    if (flight.icao)     p.set("icao",     flight.icao);
    fetch(`/api/route?${p}`)
      .then(r => r.json())
      .then(d => { setInfo(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [flight.icao]);

  const spd   = fmtSpd(flight.speed);
  const hdg   = getHeading(flight.track);
  const vrFpm = flight.vrate ? Math.round(flight.vrate) : 0;
  const vrDisp= vrFpm>50?`▲ ${vrFpm} FPM`:vrFpm<-50?`▼ ${Math.abs(vrFpm)} FPM`:"LEVEL";
  const route = info?.route;
  const ac    = info?.aircraft;

  return (
    <div className="dpanel">
      {loading && <div className="route-loading"><span style={{color:"#ff9900"}}>●</span> LOOKING UP ROUTE...</div>}
      {!loading && !route && <div className="route-none">✈ ROUTE DATA NOT AVAILABLE</div>}
      {!loading && route?.origin && route?.destination && (
        <div className="route-banner">
          <div className="route-airport">
            <div className="route-iata origin">{route.origin.iata||route.origin.icao}</div>
            <div className="route-city origin">{route.origin.city}{route.origin.country!=="United States"?`, ${route.origin.country}`:""}</div>
            <div className="route-airport-name">{route.origin.name}</div>
          </div>
          <div className="route-arrow">→</div>
          <div className="route-airport">
            <div className="route-iata dest">{route.destination.iata||route.destination.icao}</div>
            <div className="route-city dest">{route.destination.city}{route.destination.country!=="United States"?`, ${route.destination.country}`:""}</div>
            <div className="route-airport-name">{route.destination.name}</div>
          </div>
          {route.airline && (
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div className="ac-label">OPERATED BY</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:"#ffaa44",marginTop:2}}>{route.airline.toUpperCase()}</div>
            </div>
          )}
        </div>
      )}
      {!loading && ac && (
        <div className="ac-strip">
          {ac.photoUrl && <img className="ac-photo" src={ac.photoUrl} alt={ac.type} onError={e=>e.target.style.display="none"}/>}
          {ac.type         && <div className="ac-field"><div className="ac-label">AIRCRAFT</div><div className="ac-value">{ac.type.toUpperCase()}</div></div>}
          {ac.icaoType     && <div className="ac-field"><div className="ac-label">ICAO TYPE</div><div className="ac-value">{ac.icaoType}</div></div>}
          {ac.manufacturer && <div className="ac-field"><div className="ac-label">MAKER</div><div className="ac-value">{ac.manufacturer.toUpperCase()}</div></div>}
          {ac.registration && <div className="ac-field"><div className="ac-label">REG</div><div className="ac-value">{ac.registration}</div></div>}
          {ac.owner        && <div className="ac-field"><div className="ac-label">OWNER</div><div className="ac-value" style={{fontSize:10}}>{ac.owner.toUpperCase()}</div></div>}
        </div>
      )}
      <div className="stats-grid">
        <div className="stat-cell"><div className="stat-label">ALTITUDE</div><div className="stat-val">{feetAlt(flight.alt)} FT</div></div>
        <div className="stat-cell"><div className="stat-label">SPEED</div><div className="stat-val">{spd} KTS</div></div>
        <div className="stat-cell"><div className="stat-label">HEADING</div><div className="stat-val">{flight.track?Math.round(flight.track)+"° ":""}{hdg}</div></div>
        <div className="stat-cell"><div className="stat-label">VERT RATE</div><div className="stat-val" style={{color:vrFpm>50?"#44ff88":vrFpm<-50?"#ff5544":"#ffcc44"}}>{vrDisp}</div></div>
        <div className="stat-cell"><div className="stat-label">SQUAWK</div><div className="stat-val">{flight.squawk||"----"}</div></div>
        <div className="stat-cell"><div className="stat-label">ICAO HEX</div><div className="stat-val">{flight.icao.toUpperCase()}</div></div>
        <div className="stat-cell"><div className="stat-label">POSITION</div><div className="stat-val" style={{fontSize:10}}>{flight.lat.toFixed(3)}°N {Math.abs(flight.lon).toFixed(3)}°W</div></div>
        <div className="stat-cell"><div className="stat-label">DISTANCE</div><div className="stat-val">{flight.miles.toFixed(1)} MI</div></div>
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
      const zipRes  = await fetch(`/api/zip?zip=${z}`);
      const zipData = await zipRes.json();
      if (!zipRes.ok) throw new Error(zipData.error || "Invalid zip code");
      const apRes  = await fetch(`/api/airports?lat=${zipData.lat}&lon=${zipData.lon}&radius=75`);
      const apData = apRes.ok ? await apRes.json() : { airports:[], iata_codes:[] };
      onSubmit({
        zip: z, ...zipData,
        nearbyAirports: apData.airports || [],
        nearbyIata:     new Set(apData.iata_codes || []),
      });
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
        <div className="feat"><span className="feat-icon">📡</span>LIVE ADS-B</div>
        <div className="feat"><span className="feat-icon">✈</span>ORIGIN & DEST</div>
        <div className="feat"><span className="feat-icon">🛩</span>AIRCRAFT TYPE</div>
        <div className="feat"><span className="feat-icon">🆓</span>100% FREE</div>
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
  const [filterAp,   setFilterAp]   = useState(null);
  const [selTicker,   setSelTicker]  = useState(null);
  const countRef = useRef(0);
  const DIST_NM  = 25;
  const INTERVAL = 30;

  const fetchFlights = useCallback(async () => {
    setFetching(true);
    try {
      const res  = await fetch(`/api/flights?lat=${location.lat}&lon=${location.lon}&dist=${DIST_NM}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const parsed = (data.ac||[])
        .filter(a => a.lat!=null && a.lon!=null)
        .map(a => ({
          icao:    (a.hex||"??????").toLowerCase(),
          callsign:(a.flight||"").trim(),
          type:    a.t||"",
          lat:     parseFloat(a.lat), lon: parseFloat(a.lon),
          alt:     a.alt_baro??a.alt_geom??null,
          speed:   a.gs??null, track: a.track??null,
          vrate:   a.baro_rate??a.geom_rate??null,
          squawk:  a.squawk||"",
          miles:   haversine(location.lat,location.lon,parseFloat(a.lat),parseFloat(a.lon)),
        }))
        .filter(f => f.alt!=="ground" && f.alt>0)
        .sort((a,b) => a.miles-b.miles)
        .slice(0,25);
      setFlights(parsed);
      setLastUpdate(new Date());
      setError(null);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); setFetching(false); }
  }, [location]);

  // Background route fetch for local candidates
  useEffect(() => {
    const candidates = flights
      .filter(f => f.alt && f.alt<18000 && f.vrate && Math.abs(f.vrate)>150)
      .slice(0,10);
    candidates.forEach(f => {
      if (!f.callsign || routeCache[f.callsign]!==undefined) return;
      setRouteCache(c => ({...c,[f.callsign]:null}));
      const p = new URLSearchParams({callsign:f.callsign,icao:f.icao});
      fetch(`/api/route?${p}`)
        .then(r=>r.json())
        .then(d=>setRouteCache(c=>({...c,[f.callsign]:d})))
        .catch(()=>setRouteCache(c=>({...c,[f.callsign]:{}})));
    });
  }, [flights]);

  useEffect(() => {
    const t = setInterval(()=>setClock(new Date()),1000);
    return ()=>clearInterval(t);
  }, []);

  useEffect(() => {
    fetchFlights();
    countRef.current=0; setRpct(0);
    const bar = setInterval(()=>{
      countRef.current+=1;
      setRpct((countRef.current/INTERVAL)*100);
      if(countRef.current>=INTERVAL){countRef.current=0;fetchFlights();}
    },1000);
    return ()=>clearInterval(bar);
  }, [fetchFlights]);

  const avgAlt = flights.length ? Math.round(flights.reduce((s,f)=>s+(f.alt||0),0)/flights.length/1000) : 0;
  const maxSpd = flights.length ? Math.max(...flights.map(f=>fmtSpd(f.speed))) : 0;
  const fmtC   = d => d.toLocaleTimeString("en-US",{hour12:false});
  const dotClass  = fetching?"sdot fetching":error?"sdot err":"sdot live";
  const statusTxt = fetching?"UPDATING...":error?"ERROR":"LIVE";

  return (
    <div className="wall">
      {/* Header */}
      <div className="hdr">
        <div className="hdr-left">
          <div className="logo" onClick={onReset}>✈ FLYBY.LIVE</div>
          <div><div className="location-badge">{location.city.toUpperCase()}, {location.state} · ZIP {location.zip} · {DIST_NM}NM</div></div>
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

      {/* Airport filter tabs */}
      <AirportFilterBar
        airports={location.nearbyAirports}
        selected={filterAp}
        onSelect={setFilterAp}
      />

      {/* Ticker board — horizontal rows */}
      <TickerBoard
        flights={flights}
        routeCache={routeCache}
        nearbyIata={location.nearbyIata}
        nearbyAirports={location.nearbyAirports}
        filterAp={filterAp}
        selectedTicker={selTicker}
        onTickerSelect={setSelTicker}
      />

      {/* Radar map + stats side by side */}
      <div className="mid-section">
        <LiveMap
          location={location}
          flights={flights}
          nearbyAirports={location.nearbyAirports}
          selected={selected}
          onSelect={setFilterAp}
        />
        {/* Stats panel */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",alignContent:"start",gap:0,borderLeft:"none"}}>
          {[
            {n:flights.length,     l:"AIRCRAFT IN RANGE"},
            {n:maxSpd,             l:"TOP SPEED (KTS)"},
            {n:`${avgAlt}K`,       l:"AVG ALTITUDE (FT)"},
            {n:flights[0]?.miles.toFixed(1)||"--", l:"CLOSEST (MI)"},
            {n:flights.filter(f=>f.vrate&&f.vrate>200).length, l:"DEPARTING"},
            {n:flights.filter(f=>f.vrate&&f.vrate<-200).length,l:"ARRIVING"},
            {n:(location.nearbyAirports||[]).length, l:"NEARBY AIRPORTS"},
            {n:flights.filter(f=>f.alt&&f.alt>30000).length, l:"HIGH ALTITUDE"},
          ].map((s,i)=>(
            <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid #1a0f00",borderRight:i%2===0?"1px solid #1a0f00":"none"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:900,color:"#ffcc00",textShadow:"0 0 16px #ff9900",lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:8,color:"#553300",letterSpacing:3,marginTop:3}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Full flight board */}
      <div style={{overflowX:"auto"}}>
      <div className="bhdr">
        <span>CALLSIGN</span>
        <span>AIRLINE</span>
        <span>MAKER</span>
        <span>AIRCRAFT</span>
        <span style={{textAlign:"right",paddingRight:8}}>ALT (FT)</span>
        <span style={{textAlign:"right",paddingRight:8}}>SPEED</span>
        <span style={{textAlign:"center"}}>HEADING</span>
        <span style={{textAlign:"right",paddingRight:8}}>DIST</span>
        <span style={{textAlign:"center"}}>VERT RATE</span>
      </div>

      <div>
        {loading && (
          <div className="empty">
            <div className="ldots">SCANNING<span>.</span><span>.</span><span>.</span></div>
            <div style={{marginTop:10,fontSize:10,color:"#442200"}}>LIVE AIRCRAFT OVER {location.city.toUpperCase()}, {location.state}</div>
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
          const ac     = accentFor(f.callsign);
          const vrFpm  = f.vrate ? Math.round(f.vrate) : 0;
          const vrLbl  = vrFpm>50?`▲ ${vrFpm}`:vrFpm<-50?`▼ ${Math.abs(vrFpm)}`:"LEVEL";
          const vrCls  = vrFpm>50?"cell grn":vrFpm<-50?"cell red":"cell dim";
          return (
            <div key={f.icao}>
              <div className={`frow${isSel?" sel":""}`} style={{"--ac":ac}}
                   onClick={()=>setSelected(isSel?null:f.icao)}>
                {/* CALLSIGN */}
                <div className="cell">
                  <span className="pico" style={{transform:`rotate(${f.track||0}deg)`}}>✈</span>
                  <span className="cs">{f.callsign||f.icao}</span>
                </div>
                {/* AIRLINE */}
                <div className="cell" style={{fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {getAirline(f.callsign,null)}
                </div>
                {/* MAKER — from routeCache if available */}
                <div className="cell dim" style={{fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {routeCache[f.callsign]?.aircraft?.manufacturer?.toUpperCase().slice(0,10) || "—"}
                </div>
                {/* AIRCRAFT */}
                <div className="cell dim" style={{fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {routeCache[f.callsign]?.aircraft?.type?.toUpperCase() || f.type || "—"}
                </div>
                {/* ALT */}
                <div className="cell" style={{flexDirection:"column",alignItems:"flex-end",gap:2,paddingRight:8}}>
                  <span className="bright">{feetAlt(f.alt)}</span>
                  <div className="abar"><div className="afill" style={{width:`${altPct}%`}}/></div>
                </div>
                {/* SPEED */}
                <div className="cell bright" style={{justifyContent:"flex-end",paddingRight:8}}>{spd}<span className="dim" style={{fontSize:9,marginLeft:2}}>KTS</span></div>
                {/* HEADING */}
                <div className="cell" style={{justifyContent:"center"}}>{hdg}<span className="dim" style={{fontSize:9,marginLeft:2}}>{f.track?Math.round(f.track)+"°":""}</span></div>
                {/* DIST */}
                <div className="cell dim" style={{justifyContent:"flex-end",paddingRight:8}}>{f.miles.toFixed(1)}<span style={{fontSize:9,marginLeft:2}}>MI</span></div>
                {/* VERT RATE */}
                <div className={`${vrCls}`} style={{justifyContent:"center"}}>{vrLbl}<span style={{fontSize:9,marginLeft:2}}>FPM</span></div>
              </div>
              {isSel && <DetailPanel flight={f}/>}
            </div>
          );
        })}
      </div>
      </div>

      {lastUpdate && (
        <div className="foot">
          LAST UPDATE {lastUpdate.toLocaleTimeString()} · AUTO-REFRESH {INTERVAL}S ·
          DATA: <a href="https://adsb.lol" target="_blank" rel="noopener noreferrer">ADSB.LOL</a> ·
          ROUTES: <a href="https://adsbdb.com" target="_blank" rel="noopener noreferrer">ADSBDB.COM</a> ·
          ROUTE DATA © DAVID TAYLOR & JIM MASON (USED VIA API, NOT COPIED) ·
          MAP: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OPENSTREETMAP</a>
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
