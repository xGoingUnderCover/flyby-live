import { useState, useEffect, useCallback, useRef } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const AIRLINE_MAP = {
  UAL:"UNITED",DAL:"DELTA",AAL:"AMERICAN",SWA:"SOUTHWEST",JBU:"JETBLUE",
  NKS:"SPIRIT",FFT:"FRONTIER",ASA:"ALASKA",FDX:"FEDEX",UPS:"UPS AIR",
  WJA:"WESTJET",ACA:"AIR CANADA",BAW:"BRIT AIR",DLH:"LUFTHANSA",
  AFR:"AIR FRANCE",KLM:"KLM",IBE:"IBERIA",UAE:"EMIRATES",QTR:"QATAR",
  THY:"TURKISH",VIR:"VIRGIN ATL",EIN:"AER LINGUS",CLX:"CARGOLUX",
  ENY:"ENVOY",SKW:"SKYWEST",RPA:"REPUBLIC",CPZ:"COLGAN",
};
const AIRLINE_COLORS = {
  UAL:"#0033A0",DAL:"#E51937",AAL:"#0078D2",SWA:"#304CB2",JBU:"#003876",
  NKS:"#FFCB00",FFT:"#FF6A00",ASA:"#00285E",FDX:"#4D148C",UPS:"#351C15",
  WJA:"#C8102E",ACA:"#C01B2D",BAW:"#075AAA",DLH:"#05164D",AFR:"#002157",
  KLM:"#00A1DE",IBE:"#FF5F00",UAE:"#BD8B13",QTR:"#5C0632",THY:"#E81932",
};
const getAirline = (flight, routeAirline) => {
  if (routeAirline) return routeAirline.toUpperCase().slice(0,16);
  if (!flight) return "UNKNOWN";
  const code = flight.slice(0,3).toUpperCase();
  return AIRLINE_MAP[code] || flight.trim().toUpperCase().slice(0,12);
};
const getAirlineColor = (cs) => AIRLINE_COLORS[(cs||"").slice(0,3).toUpperCase()] || "#ff6600";
const getHeading = (track) => {
  if (track==null) return "---";
  const d=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return d[Math.round(track/22.5)%16];
};
const feetAlt = (ft) => ft!=null&&ft!=="ground"&&!isNaN(ft) ? Math.round(ft).toLocaleString() : "----";
const fmtSpd  = (kts) => kts!=null ? Math.round(kts) : 0;
const haversine = (lat1,lon1,lat2,lon2) => {
  const R=3958.8,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};
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
  BDL:[41.9389,-72.6832],MHT:[42.9326,-71.4357],PBI:[26.6832,-80.0956],
  TPA:[27.9755,-82.5332],STL:[38.7487,-90.3700],MSY:[29.9934,-90.2580],
  BNA:[36.1245,-86.6782],AUS:[30.1975,-97.6664],RDU:[35.8776,-78.7875],
  CUN:[21.0365,-86.8771],MEX:[19.4363,-99.0721],LHR:[51.4775,-0.4614],
  CDG:[49.0097,2.5479],FRA:[50.0379,8.5622],AMS:[52.3086,4.7639],
  MAD:[40.4719,-3.5626],BCN:[41.2971,2.0785],FCO:[41.8003,12.2389],
  YYZ:[43.6777,-79.6248],YUL:[45.4706,-73.7408],NRT:[35.7653,140.3856],
  ICN:[37.4602,126.4407],SYD:[-33.9399,151.1753],DUB:[53.4213,-6.2701],
  BUF:[42.9405,-78.7322],CLE:[41.4117,-81.8498],PIT:[40.4915,-80.2329],
  SJU:[18.4394,-66.0018],RSW:[26.5362,-81.7552],PWM:[43.6462,-70.3093],
};
const estDuration = (route) => {
  if (!route?.origin?.iata||!route?.destination?.iata) return null;
  const oc=AP_COORDS[route.origin.iata],dc=AP_COORDS[route.destination.iata];
  if (!oc||!dc) return null;
  const d=haversine(oc[0],oc[1],dc[0],dc[1]);
  if (!d||d<30) return null;
  const hrs=d/480+(25/60);
  if (hrs<1) return `~${Math.round(hrs*60)}MIN`;
  return `~${Math.floor(hrs)}H${Math.round((hrs%1)*60).toString().padStart(2,"0")}M`;
};
const estArrival = (flight, route) => {
  if (!route?.destination?.iata||!flight.speed||!flight.lat||!flight.lon) return null;
  const dc=AP_COORDS[route.destination.iata];
  if (!dc) return null;
  const distMi=haversine(flight.lat,flight.lon,dc[0],dc[1]);
  const speedMph=flight.speed*1.15078;
  if (speedMph<50) return null;
  const arrival=new Date(Date.now()+(distMi/speedMph)*3600000);
  return arrival.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true});
};

// ── Audio ping ────────────────────────────────────────────────────────────────
const playPing = () => {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440,ctx.currentTime+0.3);
    gain.gain.setValueAtTime(0.3,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
    osc.start(ctx.currentTime);osc.stop(ctx.currentTime+0.4);
  } catch(e){}
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#080600;font-family:'Share Tech Mono',monospace;color:#ff9900;}
.scanlines{position:fixed;inset:0;pointer-events:none;z-index:300;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);}
.vignette{position:fixed;inset:0;pointer-events:none;z-index:299;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,0.55) 100%);}
.dim-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);pointer-events:none;z-index:298;transition:opacity 0.5s;}

/* ── Landing ── */
.landing{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;}
.brand{font-family:'Orbitron',monospace;font-weight:900;font-size:clamp(36px,8vw,80px);color:#ffb300;text-shadow:0 0 30px #ff9900,0 0 60px #ff6600;letter-spacing:6px;line-height:1;animation:glow 3s ease-in-out infinite;}
@keyframes glow{0%,100%{text-shadow:0 0 30px #ff9900,0 0 60px #ff6600;}50%{text-shadow:0 0 40px #ffcc00,0 0 80px #ff8800;}}
.brand-plane{font-size:clamp(28px,5vw,56px);margin-right:12px;display:inline-block;animation:flyIn 1.2s ease-out;}
@keyframes flyIn{from{transform:translateX(-80px);opacity:0;}to{transform:translateX(0);opacity:1;}}
.tagline{font-size:clamp(12px,2vw,16px);color:#aa6600;letter-spacing:4px;margin-top:12px;margin-bottom:36px;}
.zip-form{display:flex;width:100%;max-width:380px;}
.zip-input{flex:1;background:#0f0900;border:2px solid #3a2200;border-right:none;color:#ffcc00;font-family:'Orbitron',monospace;font-size:22px;font-weight:700;letter-spacing:6px;padding:14px 16px;outline:none;text-align:center;transition:border-color 0.2s;}
.zip-input::placeholder{color:#3a2200;}
.zip-input:focus{border-color:#ff9900;}
.zip-btn{background:#ff8800;border:2px solid #ff8800;color:#000;font-family:'Orbitron',monospace;font-size:13px;font-weight:900;letter-spacing:2px;padding:14px 20px;cursor:pointer;transition:background 0.15s;white-space:nowrap;}
.zip-btn:hover{background:#ffaa00;}
.zip-btn:disabled{opacity:0.5;cursor:not-allowed;}
.geo-btn{margin-top:14px;width:100%;max-width:380px;background:none;border:1px solid #3a2200;color:#885500;font-family:'Share Tech Mono',monospace;font-size:12px;letter-spacing:3px;padding:10px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;}
.geo-btn:hover{border-color:#ff9900;color:#ff9900;background:#0f0800;}
.geo-btn:disabled{opacity:0.4;cursor:not-allowed;}
.zip-error{margin-top:10px;font-size:12px;color:#ff4400;letter-spacing:2px;}
.features{display:flex;gap:28px;margin-top:48px;flex-wrap:wrap;justify-content:center;}
.feat{font-size:11px;color:#553300;letter-spacing:2px;text-align:center;}
.feat-icon{font-size:20px;display:block;margin-bottom:5px;}

/* ── Header ── */
.wall{min-height:100vh;background:#080600;}
.hdr{padding:10px 20px 8px;border-bottom:2px solid #2a1800;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.hdr-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.logo{font-family:'Orbitron',monospace;font-weight:900;font-size:17px;color:#ffb300;text-shadow:0 0 16px #ff9900,0 0 32px #ff6600;letter-spacing:3px;cursor:pointer;white-space:nowrap;}
.logo:hover{color:#ffcc44;}
.location-badge{font-size:10px;color:#884400;letter-spacing:2px;white-space:nowrap;}
.hdr-btn{background:none;border:1px solid #2a1800;color:#664400;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;padding:3px 10px;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
.hdr-btn:hover{border-color:#ff9900;color:#ff9900;}
.hdr-btn.active{border-color:#ffaa00;color:#ffaa00;background:#1a0f00;}
.hdr-btn.pause{border-color:#ff4400;color:#ff4400;}
.hdr-btn.pause:hover{background:#1a0000;}
.hdr-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.clock{font-family:'Orbitron',monospace;font-size:17px;color:#ffcc00;text-shadow:0 0 10px #ffaa00;letter-spacing:2px;}
.sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.sdot.live{background:#00ff44;box-shadow:0 0 8px #00ff44;animation:blink 1.5s ease-in-out infinite;}
.sdot.paused{background:#ff8800;box-shadow:0 0 8px #ff8800;}
.sdot.err{background:#ff3300;box-shadow:0 0 8px #ff3300;}
.sdot.fetching{background:#ffaa00;box-shadow:0 0 8px #ffaa00;animation:blink 0.5s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0.2;}}
.stxt{font-size:10px;color:#cc8800;letter-spacing:2px;}
.cbadge{font-family:'Orbitron',monospace;font-size:10px;color:#ff9900;background:#120c00;border:1px solid #2a1800;padding:2px 8px;white-space:nowrap;}
.rbar{height:2px;background:#120c00;}
.rfill{height:100%;background:linear-gradient(90deg,#ff6600,#ffcc00);box-shadow:0 0 8px #ff9900;transition:width 1s linear;}
.rfill.paused{background:#554400;box-shadow:none;}

/* ── Overhead banner ── */
.overhead-banner{padding:6px 20px;background:#0f1a00;border-bottom:2px solid #44ff8844;display:flex;align-items:center;gap:10px;flex-wrap:wrap;animation:pulse-bg 2s ease-in-out infinite;}
@keyframes pulse-bg{0%,100%{background:#0f1a00;}50%{background:#162400;}}
.overhead-label{font-size:9px;color:#44ff88;letter-spacing:3px;font-family:'Orbitron',monospace;}
.overhead-flight{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#44ff88;text-shadow:0 0 8px #44ff8888;background:#00ff0011;border:1px solid #44ff8833;padding:2px 8px;cursor:pointer;transition:background 0.15s;}
.overhead-flight:hover{background:#00ff0022;}

/* ── Top 9 flight cards ── */
.cards-section{padding:12px 16px;background:#090700;border-bottom:2px solid #1a0f00;}
.cards-title{font-size:8px;color:#443300;letter-spacing:4px;font-family:'Orbitron',monospace;margin-bottom:10px;}
.cards-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.flight-card{
  background:#0c0900;border:1px solid #2a1800;
  padding:12px 14px;cursor:pointer;
  transition:all 0.15s;position:relative;
  overflow:hidden;
}
.flight-card:hover{background:#160d00;border-color:#443300;}
.flight-card.sel{background:#1a1000;border-color:#ffaa00;box-shadow:0 0 12px #ff880033;}
.flight-card.overhead{background:#0c1800;border-color:#44ff8866;box-shadow:0 0 10px #44ff8822;}
.flight-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac,#ff6600);box-shadow:0 0 6px var(--ac,#ff6600);}
.card-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;}
.card-cs{font-family:'Orbitron',monospace;font-weight:900;font-size:14px;color:#ffcc00;text-shadow:0 0 10px #ffaa0055;letter-spacing:1px;}
.card-status{font-size:10px;font-weight:bold;letter-spacing:1px;padding:2px 7px;border-radius:2px;}
.card-dep{color:#44ff88;background:#00ff0011;border:1px solid #44ff8833;}
.card-arr{color:#ff5544;background:#ff000011;border:1px solid #ff554433;}
.card-pat{color:#886633;background:#88660011;border:1px solid #88663333;}
.card-airline{display:flex;align-items:center;gap:6px;margin-bottom:5px;}
.al-badge{display:inline-block;padding:1px 6px;font-size:9px;font-weight:bold;letter-spacing:1px;border-radius:2px;font-family:'Orbitron',monospace;}
.card-airline-name{font-size:11px;color:#cc8844;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.card-aircraft{font-size:10px;color:#664400;margin-bottom:6px;}
.card-route{font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:5px;}
.card-iata{font-family:'Orbitron',monospace;font-size:13px;font-weight:700;}
.card-iata.orig{color:#44aaff;}
.card-iata.dest{color:#ff6644;}
.card-arrow{color:#554400;}
.card-city{font-size:9px;color:#553300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.card-alt-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.card-alt-num{font-family:'Orbitron',monospace;font-size:13px;color:#ffdd55;text-shadow:0 0 8px #ffaa0044;white-space:nowrap;}
.card-alt-label{font-size:9px;color:#553300;}
.card-alt-bar{flex:1;height:5px;background:#160d00;border-radius:3px;overflow:hidden;}
.card-alt-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#ff4400,#ffcc00);transition:width 0.5s;}
.card-footer{display:flex;gap:12px;flex-wrap:wrap;}
.card-stat{display:flex;flex-direction:column;gap:1px;}
.card-stat-label{font-size:7px;color:#443300;letter-spacing:2px;}
.card-stat-val{font-size:10px;color:#ffaa44;font-family:'Orbitron',monospace;}
.card-details-btn{
  margin-top:8px;width:100%;
  background:none;border:1px solid #2a1800;color:#664400;
  font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;
  padding:4px;cursor:pointer;transition:all 0.15s;
}
.card-details-btn:hover{border-color:#ff9900;color:#ff9900;background:#0f0800;}
.no-local{padding:16px;text-align:center;font-size:11px;color:#332200;letter-spacing:3px;}

/* ── Map ── */
.map-section{border-bottom:2px solid #1a0f00;}
.map-title{font-size:8px;color:#443300;letter-spacing:3px;font-family:'Orbitron',monospace;padding:7px 16px 5px;background:#090700;border-bottom:1px solid #1a0f00;}
.map-container{height:480px;position:relative;}
.leaflet-container{background:#0a0800 !important;}
.leaflet-tile{filter:invert(1) hue-rotate(180deg) saturate(0.4) brightness(0.5);}
.leaflet-control-attribution{display:none !important;}
.leaflet-control-zoom a{background:#0d0900 !important;border-color:#2a1800 !important;color:#ff9900 !important;font-weight:bold;}
.leaflet-control-zoom a:hover{background:#1a0f00 !important;}
.leaflet-popup-content-wrapper{background:#0d0900;border:1px solid #2a1800;color:#ff9900;font-family:'Share Tech Mono',monospace;font-size:11px;border-radius:0;box-shadow:0 0 12px #ff880033;}
.leaflet-popup-tip{background:#0d0900;}
.leaflet-popup-close-button{color:#ff6600 !important;}

/* ── Airport FIDS ── */
.fids-section{padding:0;}
.ap-filter-bar{padding:6px 16px;background:#0a0700;border-bottom:1px solid #1a0f00;display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.ap-filter-label{font-size:8px;color:#443300;letter-spacing:3px;margin-right:4px;white-space:nowrap;}
.ap-tab{background:none;border:1px solid #2a1800;color:#664400;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;padding:2px 9px;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
.ap-tab:hover{border-color:#ff9900;color:#ff9900;}
.ap-tab.active{background:#1a0f00;border-color:#ff8800;color:#ffaa00;box-shadow:0 0 6px #ff880033;}
.ap-tab.all{border-color:#3a2800;color:#885500;}
.ap-tab.all.active{border-color:#ffcc00;color:#ffcc00;background:#1a1000;}
.fids-board{padding:12px 16px;display:flex;flex-direction:column;gap:16px;}
.fids-airport{background:#090700;border:1px solid #1a0f00;}
.fids-ap-header{
  padding:8px 14px;background:#0a0800;border-bottom:1px solid #1a0f00;
  display:flex;align-items:center;justify-content:space-between;
}
.fids-ap-name{font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#ffcc00;letter-spacing:2px;}
.fids-ap-sub{font-size:9px;color:#664400;letter-spacing:2px;margin-top:2px;}
.fids-ap-dist{font-size:10px;color:#553300;letter-spacing:2px;}
.fids-cols{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #1a0f00;}
.fids-col{padding:0;}
.fids-col-hdr{
  padding:5px 12px;background:#080600;border-bottom:1px solid #1a0f00;
  font-size:8px;letter-spacing:3px;display:flex;align-items:center;gap:6px;
}
.fids-col-hdr.dep{color:#44ff8899;border-right:1px solid #1a0f00;}
.fids-col-hdr.arr{color:#ff554499;}
.fids-col.dep{border-right:1px solid #1a0f00;}
.fids-row{
  display:grid;grid-template-columns:90px 1fr 70px 60px;
  padding:6px 12px;border-bottom:1px solid #0f0800;
  font-size:11px;align-items:center;transition:background 0.15s;cursor:pointer;
}
.fids-row:hover{background:#120900;}
.fids-row:last-child{border-bottom:none;}
.fids-cs{font-family:'Orbitron',monospace;font-size:10px;font-weight:700;color:#ffcc00;}
.fids-dest{color:#cc8844;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fids-alt{font-size:10px;color:#ffaa33;text-align:right;}
.fids-status{font-size:9px;font-weight:bold;text-align:right;}
.fids-status.dep{color:#44ff88;}
.fids-status.arr{color:#ff5544;}
.fids-empty{padding:10px 12px;font-size:10px;color:#2a1800;letter-spacing:2px;text-align:center;}
.fids-none{padding:16px;text-align:center;font-size:11px;color:#2a1800;letter-spacing:3px;}

/* ── Detail overlay ── */
.detail-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:500;
  display:flex;align-items:center;justify-content:center;padding:20px;
  animation:overlayIn 0.2s ease-out;
}
@keyframes overlayIn{from{opacity:0;}to{opacity:1;}}
.detail-modal{
  background:#0d0900;border:1px solid #2a1800;width:100%;max-width:600px;
  max-height:90vh;overflow-y:auto;box-shadow:0 0 40px #ff880033;
  animation:modalIn 0.2s ease-out;
}
@keyframes modalIn{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}
.modal-hdr{
  padding:12px 16px;background:#0a0700;border-bottom:1px solid #1a0f00;
  display:flex;align-items:center;justify-content:space-between;
}
.modal-title{font-family:'Orbitron',monospace;font-size:14px;color:#ffcc00;letter-spacing:2px;}
.modal-close{background:none;border:1px solid #2a1800;color:#664400;font-size:14px;padding:2px 10px;cursor:pointer;}
.modal-close:hover{border-color:#ff9900;color:#ff9900;}
.route-banner{padding:14px 16px 10px;display:flex;align-items:center;gap:0;border-bottom:1px solid #1a0f00;flex-wrap:wrap;}
.route-airport{display:flex;flex-direction:column;min-width:110px;}
.route-iata{font-family:'Orbitron',monospace;font-size:30px;font-weight:900;line-height:1;}
.route-iata.origin{color:#44aaff;text-shadow:0 0 16px #44aaff55;}
.route-iata.dest{color:#ff6644;text-shadow:0 0 16px #ff664455;}
.route-city{font-size:10px;margin-top:3px;letter-spacing:2px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.route-city.origin{color:#3388cc;}
.route-city.dest{color:#cc5533;}
.route-airport-name{font-size:8px;color:#443300;letter-spacing:1px;margin-top:2px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.route-arrow{font-size:22px;color:#664400;padding:0 14px;flex-shrink:0;align-self:center;}
.route-extra{margin-left:auto;text-align:right;display:flex;flex-direction:column;gap:5px;}
.route-loading{padding:14px 16px;font-size:11px;color:#664400;letter-spacing:3px;border-bottom:1px solid #1a0f00;}
.route-none{padding:10px 16px;font-size:10px;color:#443300;letter-spacing:2px;border-bottom:1px solid #1a0f00;}
.ac-strip{padding:8px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-bottom:1px solid #1a0f00;}
.ac-field{display:flex;flex-direction:column;gap:2px;}
.ac-label{font-size:7px;color:#553300;letter-spacing:3px;}
.ac-value{font-family:'Orbitron',monospace;font-size:12px;color:#ffcc44;}
.ac-photo{width:80px;height:48px;object-fit:cover;border:1px solid #2a1800;flex-shrink:0;}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);}
.stat-cell{padding:8px 12px;border-right:1px solid #1a0f00;}
.stat-cell:last-child{border-right:none;}
.stat-label{font-size:7px;color:#553300;letter-spacing:3px;}
.stat-val{font-family:'Orbitron',monospace;font-size:12px;color:#ffcc44;margin-top:2px;}

/* ── Share toast ── */
.share-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0d0900;border:1px solid #ff8800;color:#ffaa44;font-family:'Share Tech Mono',monospace;font-size:12px;letter-spacing:2px;padding:10px 20px;z-index:600;animation:toastIn 0.3s ease-out;}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.ping-dot{width:6px;height:6px;border-radius:50%;background:#ff6600;display:inline-block;margin-left:4px;animation:ping 1s ease-in-out infinite;}
@keyframes ping{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(1.4);}}

/* ── Misc ── */
.empty{padding:40px 20px;text-align:center;color:#332200;font-size:12px;letter-spacing:3px;}
.ldots span{animation:ld 1.2s ease-in-out infinite;color:#ff9900;}
.ldots span:nth-child(2){animation-delay:0.2s;}
.ldots span:nth-child(3){animation-delay:0.4s;}
@keyframes ld{0%,80%,100%{opacity:0.2;}40%{opacity:1;}}
.errbanner{padding:5px 20px;font-size:10px;color:#ff6600;background:#100500;letter-spacing:1px;border-bottom:1px solid #300000;}
.foot{padding:6px 20px;font-size:8px;color:#332200;letter-spacing:2px;display:flex;gap:4px;flex-wrap:wrap;}
.foot a{color:#553300;text-decoration:none;}
.foot a:hover{color:#ff9900;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:#080600;}
::-webkit-scrollbar-thumb{background:#2a1800;}

@media(max-width:700px){
  .cards-grid{grid-template-columns:1fr 1fr;}
  .map-container{height:300px;}
  .fids-row{grid-template-columns:80px 1fr 60px;}
  .fids-row>*:nth-child(4){display:none;}
}
@media(max-width:480px){
  .cards-grid{grid-template-columns:1fr;}
}
`;

// ─── Landing ──────────────────────────────────────────────────────────────────
function Landing({ onSubmit }) {
  const [zip,setZip]     = useState(()=>localStorage.getItem("flyby_zip")||"");
  const [busy,setBusy]   = useState(false);
  const [geobusy,setGeobusy] = useState(false);
  const [err,setErr]     = useState("");

  const doLookup = async (z, lat, lon) => {
    let zipData;
    if (lat&&lon) {
      zipData = {lat,lon,city:"YOUR LOCATION",state:"",zip:z||""};
    } else {
      const r=await fetch(`/api/zip?zip=${z}`);
      zipData=await r.json();
      if (!r.ok) throw new Error(zipData.error||"Invalid zip code");
    }
    const apRes=await fetch(`/api/airports?lat=${zipData.lat}&lon=${zipData.lon}&radius=75`);
    const apData=apRes.ok?await apRes.json():{airports:[],iata_codes:[]};
    if (z) localStorage.setItem("flyby_zip",z);
    onSubmit({zip:z,...zipData,nearbyAirports:apData.airports||[],nearbyIata:new Set(apData.iata_codes||[])});
  };

  const handleSubmit=async(e)=>{
    e.preventDefault();
    const z=zip.trim();
    if (!/^\d{5}$/.test(z)){setErr("Enter a valid 5-digit US zip code");return;}
    setBusy(true);setErr("");
    try{await doLookup(z);}catch(e){setErr(e.message);}
    setBusy(false);
  };

  const handleGeo=()=>{
    if (!navigator.geolocation){setErr("Geolocation not supported");return;}
    setGeobusy(true);setErr("");
    navigator.geolocation.getCurrentPosition(
      async(pos)=>{
        try{await doLookup("",pos.coords.latitude,pos.coords.longitude);}
        catch(e){setErr(e.message);}
        setGeobusy(false);
      },
      ()=>{setErr("Location access denied — enter your zip code");setGeobusy(false);}
    );
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
        <button className="zip-btn" type="submit" disabled={busy||geobusy}>{busy?"...":"TRACK ▶"}</button>
      </form>
      <button className="geo-btn" onClick={handleGeo} disabled={busy||geobusy}>
        {geobusy?"📡 FINDING YOUR LOCATION...":"📍 USE MY CURRENT LOCATION"}
      </button>
      {err&&<div className="zip-error">⚠ {err}</div>}
      <div className="features">
        <div className="feat"><span className="feat-icon">📡</span>LIVE ADS-B</div>
        <div className="feat"><span className="feat-icon">📍</span>AUTO LOCATE</div>
        <div className="feat"><span className="feat-icon">✈</span>ORIGIN & DEST</div>
        <div className="feat"><span className="feat-icon">🛩</span>AIRCRAFT TYPE</div>
        <div className="feat"><span className="feat-icon">🆓</span>100% FREE</div>
      </div>
    </div>
  );
}

// ─── Detail overlay ───────────────────────────────────────────────────────────
function DetailOverlay({ flight, routeInfo, onClose, onShare }) {
  const [info,setInfo]     = useState(routeInfo||null);
  const [loading,setLoading] = useState(!routeInfo);

  useEffect(()=>{
    if (routeInfo){setInfo(routeInfo);setLoading(false);return;}
    setLoading(true);
    const p=new URLSearchParams();
    if (flight.callsign) p.set("callsign",flight.callsign);
    if (flight.icao)     p.set("icao",flight.icao);
    fetch(`/api/route?${p}`).then(r=>r.json())
      .then(d=>{setInfo(d);setLoading(false);})
      .catch(()=>setLoading(false));
  },[flight.icao]);

  const route=info?.route, ac=info?.aircraft;
  const vrFpm=flight.vrate?Math.round(flight.vrate):0;
  const vrDisp=vrFpm>50?`▲ ${vrFpm} FPM`:vrFpm<-50?`▼ ${Math.abs(vrFpm)} FPM`:"LEVEL";
  const arrTime=estArrival(flight,route);
  const duration=estDuration(route);

  return (
    <div className="detail-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="detail-modal">
        <div className="modal-hdr">
          <div className="modal-title">
            ✈ {flight.callsign||flight.icao.toUpperCase()}
            {flight.type&&<span style={{fontSize:11,color:"#664400",marginLeft:8}}>{flight.type}</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button className="modal-close" onClick={()=>onShare(flight.icao,flight.callsign)}>🔗 SHARE</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading&&<div className="route-loading"><span style={{color:"#ff9900"}}>●</span> LOOKING UP ROUTE...</div>}
        {!loading&&!route&&<div className="route-none">✈ ROUTE DATA NOT AVAILABLE FOR THIS FLIGHT</div>}

        {!loading&&route?.origin&&route?.destination&&(
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
            <div className="route-extra">
              {route.airline&&<div><div className="ac-label">OPERATED BY</div><div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:"#ffaa44",marginTop:2}}>{route.airline.toUpperCase()}</div></div>}
              {duration&&<div><div className="ac-label">FLIGHT TIME</div><div style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:"#ffcc44",marginTop:2}}>{duration}</div></div>}
              {arrTime&&<div><div className="ac-label">EST. ARRIVAL</div><div style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:"#44ff88",marginTop:2}}>{arrTime}</div></div>}
            </div>
          </div>
        )}

        {!loading&&ac&&(
          <div className="ac-strip">
            {ac.photoUrl&&<img className="ac-photo" src={ac.photoUrl} alt={ac.type} onError={e=>e.target.style.display="none"}/>}
            {ac.type&&<div className="ac-field"><div className="ac-label">AIRCRAFT</div><div className="ac-value">{ac.type.toUpperCase()}</div></div>}
            {ac.manufacturer&&<div className="ac-field"><div className="ac-label">MAKER</div><div className="ac-value">{ac.manufacturer.toUpperCase()}</div></div>}
            {ac.registration&&<div className="ac-field"><div className="ac-label">REG</div><div className="ac-value">{ac.registration}</div></div>}
            {ac.owner&&<div className="ac-field"><div className="ac-label">OWNER</div><div className="ac-value" style={{fontSize:10}}>{ac.owner.toUpperCase()}</div></div>}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-cell"><div className="stat-label">ALTITUDE</div><div className="stat-val">{feetAlt(flight.alt)} FT</div></div>
          <div className="stat-cell"><div className="stat-label">SPEED</div><div className="stat-val">{fmtSpd(flight.speed)} KTS</div></div>
          <div className="stat-cell"><div className="stat-label">HEADING</div><div className="stat-val">{flight.track?Math.round(flight.track)+"° ":""}{getHeading(flight.track)}</div></div>
          <div className="stat-cell"><div className="stat-label">VERT RATE</div><div className="stat-val" style={{color:vrFpm>50?"#44ff88":vrFpm<-50?"#ff5544":"#ffcc44"}}>{vrDisp}</div></div>
          <div className="stat-cell"><div className="stat-label">SQUAWK</div><div className="stat-val">{flight.squawk||"----"}</div></div>
          <div className="stat-cell"><div className="stat-label">ICAO HEX</div><div className="stat-val">{flight.icao.toUpperCase()}</div></div>
          <div className="stat-cell"><div className="stat-label">POSITION</div><div className="stat-val" style={{fontSize:10}}>{flight.lat?.toFixed(3)}°N {Math.abs(flight.lon||0).toFixed(3)}°W</div></div>
          <div className="stat-cell"><div className="stat-label">DISTANCE</div><div className="stat-val">{flight.miles?.toFixed(1)} MI</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── Top 9 flight cards ───────────────────────────────────────────────────────
function FlightCards({ flights, routeCache, location, selectedId, onSelect, onDetails }) {
  const top9 = flights.slice(0,9);

  if (!top9.length) {
    return (
      <div className="cards-section">
        <div className="cards-title">NEAREST AIRCRAFT</div>
        <div className="no-local">
          {flights.length===0
            ? <div className="ldots">SCANNING<span>.</span><span>.</span><span>.</span></div>
            : "NO AIRCRAFT IN RANGE"}
        </div>
      </div>
    );
  }

  return (
    <div className="cards-section">
      <div className="cards-title">NEAREST AIRCRAFT · SORTED BY DISTANCE</div>
      <div className="cards-grid">
        {top9.map(f=>{
          const vrFpm=f.vrate?Math.round(f.vrate):0;
          const isDep=vrFpm>150,isArr=vrFpm<-150;
          const statusCls=isDep?"card-status card-dep":isArr?"card-status card-arr":"card-status card-pat";
          const statusTxt=isDep?"▲ CLIMBING":isArr?"▼ DESCENDING":"→ CRUISING";
          const cached=f.callsign?routeCache[f.callsign]:undefined;
          const route=cached?.route;
          const aircraft=cached?.aircraft;
          const alColor=getAirlineColor(f.callsign);
          const altPct=Math.min(100,((f.alt||0)/40000)*100);
          const isOverhead=haversine(location.lat,location.lon,f.lat||0,f.lon||0)<5;
          const isSel=selectedId===f.icao;
          const acType=aircraft?.type||f.type||"";

          return (
            <div key={f.icao}
              className={`flight-card${isSel?" sel":""}${isOverhead?" overhead":""}`}
              style={{"--ac":getAirlineColor(f.callsign)}}
              onClick={()=>onSelect(isSel?null:f.icao)}>

              {/* Top row: callsign + status */}
              <div className="card-top">
                <div className="card-cs">
                  {f.callsign||f.icao.toUpperCase()}
                  {isOverhead&&<span style={{fontSize:9,color:"#44ff88",marginLeft:4}}>● OVERHEAD</span>}
                </div>
                <div className={statusCls}>{statusTxt}</div>
              </div>

              {/* Airline */}
              <div className="card-airline">
                <span className="al-badge" style={{background:alColor+"22",border:`1px solid ${alColor}44`,color:alColor}}>
                  {(f.callsign||"???").slice(0,3).toUpperCase()}
                </span>
                <span className="card-airline-name">
                  {cached===undefined&&f.callsign?"···":getAirline(f.callsign,route?.airline)}
                </span>
              </div>

              {/* Aircraft type */}
              {acType&&<div className="card-aircraft">{acType.toUpperCase()}</div>}

              {/* Route */}
              {route?.origin&&route?.destination?(
                <div className="card-route">
                  <span className="card-iata orig">{route.origin.iata}</span>
                  <span className="card-arrow">→</span>
                  <span className="card-iata dest">{route.destination.iata}</span>
                  <span className="card-city">&nbsp;{route.origin.city?.slice(0,7).toUpperCase()}→{route.destination.city?.slice(0,7).toUpperCase()}</span>
                </div>
              ):cached===undefined&&f.callsign?(
                <div className="card-route" style={{color:"#332000"}}>···</div>
              ):null}

              {/* Altitude bar */}
              <div className="card-alt-row">
                <div>
                  <div className="card-alt-num">{feetAlt(f.alt)} <span style={{fontSize:9,color:"#664400"}}>FT</span></div>
                </div>
                <div className="card-alt-bar">
                  <div className="card-alt-fill" style={{width:`${altPct}%`}}/>
                </div>
              </div>

              {/* Stats row */}
              <div className="card-footer">
                <div className="card-stat">
                  <div className="card-stat-label">SPEED</div>
                  <div className="card-stat-val">{fmtSpd(f.speed)} KTS</div>
                </div>
                <div className="card-stat">
                  <div className="card-stat-label">HEADING</div>
                  <div className="card-stat-val">{getHeading(f.track)}</div>
                </div>
                <div className="card-stat">
                  <div className="card-stat-label">DISTANCE</div>
                  <div className="card-stat-val">{f.miles.toFixed(1)} MI</div>
                </div>
              </div>

              {/* Details button */}
              <button className="card-details-btn"
                onClick={e=>{e.stopPropagation();onDetails(f);}}>
                VIEW FULL DETAILS
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Live map ─────────────────────────────────────────────────────────────────
function LiveMap({ location, flights, nearbyAirports, selectedId, onSelectAp }) {
  const mapRef=useRef(null),leafletRef=useRef(null);
  const markersRef=useRef([]),apMarkersRef=useRef([]);
  const selectedMarkerRef=useRef(null);

  useEffect(()=>{
    if (document.getElementById("leaflet-css")) return;
    const link=document.createElement("link");
    link.id="leaflet-css";link.rel="stylesheet";
    link.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script=document.createElement("script");
    script.id="leaflet-js";
    script.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    document.head.appendChild(script);
  },[]);

  useEffect(()=>{
    const init=()=>{
      if (!mapRef.current||leafletRef.current) return;
      if (!window.L){setTimeout(init,200);return;}
      const L=window.L;
      const map=L.map(mapRef.current,{center:[location.lat,location.lon],zoom:10,zoomControl:true,attributionControl:false});
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:14}).addTo(map);
      const homeIcon=L.divIcon({className:"",
        html:`<div style="width:12px;height:12px;background:#ff9900;border:2px solid #ffcc00;border-radius:50%;box-shadow:0 0 12px #ff990099;"></div>`,
        iconSize:[12,12],iconAnchor:[6,6]});
      L.marker([location.lat,location.lon],{icon:homeIcon}).addTo(map)
        .bindPopup(`<b>${location.city?.toUpperCase()||"YOUR LOCATION"}${location.state?`, ${location.state}`:""}</b><br>ZIP ${location.zip||""}`);
      leafletRef.current=map;
    };
    setTimeout(init,300);
    return()=>{if(leafletRef.current){leafletRef.current.remove();leafletRef.current=null;}};
  },[location]);

  useEffect(()=>{
    const L=window.L,map=leafletRef.current;
    if (!L||!map) return;
    apMarkersRef.current.forEach(m=>m.remove());
    apMarkersRef.current=[];
    (nearbyAirports||[]).forEach(ap=>{
      const isLarge=ap.type==="large_airport";
      const icon=L.divIcon({className:"",
        html:`<div style="width:${isLarge?14:10}px;height:${isLarge?14:10}px;background:${isLarge?"#ff880033":"#ff660011"};border:${isLarge?"2px":"1px"} solid ${isLarge?"#ff8800":"#aa5500"};transform:rotate(45deg);${isLarge?"box-shadow:0 0 8px #ff880055;":""}cursor:pointer;"></div>`,
        iconSize:[isLarge?14:10,isLarge?14:10],iconAnchor:[isLarge?7:5,isLarge?7:5]});
      const label=L.divIcon({className:"",
        html:`<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:${isLarge?"#ff8800":"#885500"};white-space:nowrap;margin-left:10px;margin-top:-4px;text-shadow:0 0 4px #000;">${ap.iata}</div>`,
        iconSize:[40,14],iconAnchor:[0,7]});
      const m=L.marker([ap.lat,ap.lon],{icon}).addTo(map)
        .bindPopup(`<b>${ap.iata}</b> — ${ap.name}<br>${ap.city} · ${ap.dist} mi`)
        .on("click",()=>onSelectAp&&onSelectAp(ap.iata));
      const l=L.marker([ap.lat,ap.lon],{icon:label,interactive:false}).addTo(map);
      apMarkersRef.current.push(m,l);
    });
  },[nearbyAirports,leafletRef.current]);

  useEffect(()=>{
    const L=window.L,map=leafletRef.current;
    if (!L||!map) return;
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    flights.forEach(f=>{
      if (!f.lat||!f.lon) return;
      const isSelected=selectedId===f.icao;
      const isOverhead=haversine(location.lat,location.lon,f.lat,f.lon)<5;
      const isLocal=f.alt&&f.alt<18000&&f.vrate&&Math.abs(f.vrate)>150;
      const isDep=f.vrate&&f.vrate>150,isArr=f.vrate&&f.vrate<-150;
      const color=isSelected?"#ffffff":isOverhead?"#44ffff":isLocal&&isDep?"#44ff88":isLocal&&isArr?"#ff5544":"#ff9900";
      const sz=isSelected?20:isOverhead?16:isLocal?13:9;
      const icon=L.divIcon({className:"",
        html:`<div style="font-size:${sz}px;color:${color};transform:rotate(${f.track||0}deg);text-shadow:0 0 ${isSelected?12:6}px ${color}${isSelected?"":"88"};line-height:1;cursor:pointer;${isSelected?"filter:drop-shadow(0 0 6px #fff);":""}">✈</div>`,
        iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
      const popup=`<b>${f.callsign||f.icao.toUpperCase()}</b><br>${feetAlt(f.alt)} FT · ${fmtSpd(f.speed)} KTS<br>${getHeading(f.track)} ${f.track?Math.round(f.track)+"°":""}${isOverhead?"<br><span style='color:#44ff88'>⬆ DIRECTLY OVERHEAD</span>":""}`;
      const m=L.marker([f.lat,f.lon],{icon,zIndexOffset:isSelected?1000:0}).addTo(map).bindPopup(popup);
      if (isSelected) {
        m.openPopup();
        map.panTo([f.lat,f.lon],{animate:true,duration:0.5});
      }
      markersRef.current.push(m);
    });
  },[flights,selectedId]);

  return (
    <div className="map-section">
      <div className="map-title">LIVE MAP · {(nearbyAirports||[]).length} AIRPORTS · {flights.length} AIRCRAFT · CLICK ANY PLANE OR AIRPORT</div>
      <div className="map-container" ref={mapRef}/>
    </div>
  );
}

// ─── Airport FIDS board ───────────────────────────────────────────────────────
function FidsBoard({ flights, routeCache, nearbyAirports, nearbyIata, filterAp, onFilterAp, onDetails }) {
  if (!nearbyAirports||nearbyAirports.length===0) return null;

  const visibleAirports = filterAp
    ? nearbyAirports.filter(ap=>ap.iata===filterAp)
    : nearbyAirports.slice(0,4);

  return (
    <div className="fids-section">
      <div className="ap-filter-bar">
        <span className="ap-filter-label">AIRPORT:</span>
        <button className={`ap-tab all${!filterAp?" active":""}`} onClick={()=>onFilterAp(null)}>ALL</button>
        {nearbyAirports.map(ap=>(
          <button key={ap.iata}
            className={`ap-tab${filterAp===ap.iata?" active":""}`}
            onClick={()=>onFilterAp(filterAp===ap.iata?null:ap.iata)}
            title={`${ap.name} · ${ap.dist} mi`}>
            {ap.iata}
          </button>
        ))}
      </div>

      <div className="fids-board">
        {visibleAirports.map(ap=>{
          // Find flights serving this airport
          const apFlights = flights.filter(f=>{
            const cached=f.callsign?routeCache[f.callsign]:null;
            if (!cached?.route) return false;
            return cached.route.origin?.iata===ap.iata||cached.route.destination?.iata===ap.iata;
          });

          const departing = apFlights
            .filter(f=>routeCache[f.callsign]?.route?.origin?.iata===ap.iata)
            .sort((a,b)=>a.miles-b.miles);
          const arriving = apFlights
            .filter(f=>routeCache[f.callsign]?.route?.destination?.iata===ap.iata)
            .sort((a,b)=>a.miles-b.miles);

          return (
            <div key={ap.iata} className="fids-airport">
              <div className="fids-ap-header">
                <div>
                  <div className="fids-ap-name">✈ {ap.iata} — {ap.city.toUpperCase()}</div>
                  <div className="fids-ap-sub">{ap.name.toUpperCase()}</div>
                </div>
                <div className="fids-ap-dist">{ap.dist} MI AWAY</div>
              </div>

              <div className="fids-cols">
                {/* Departures */}
                <div className="fids-col dep">
                  <div className="fids-col-hdr dep">▲ DEPARTURES ({departing.length})</div>
                  {departing.length===0
                    ? <div className="fids-empty">NO DEPARTURES TRACKED</div>
                    : departing.slice(0,6).map(f=>{
                        const dest=routeCache[f.callsign]?.route?.destination;
                        return (
                          <div key={f.icao} className="fids-row"
                            onClick={()=>onDetails(f)}>
                            <div className="fids-cs">{f.callsign||f.icao.toUpperCase()}</div>
                            <div className="fids-dest">→ {dest?.iata||"?"} {dest?.city?.slice(0,10).toUpperCase()||""}</div>
                            <div className="fids-alt">{feetAlt(f.alt)}</div>
                            <div className="fids-status dep">▲ DEPT</div>
                          </div>
                        );
                      })}
                </div>

                {/* Arrivals */}
                <div className="fids-col arr">
                  <div className="fids-col-hdr arr">▼ ARRIVALS ({arriving.length})</div>
                  {arriving.length===0
                    ? <div className="fids-empty">NO ARRIVALS TRACKED</div>
                    : arriving.slice(0,6).map(f=>{
                        const orig=routeCache[f.callsign]?.route?.origin;
                        const arr=estArrival(f,routeCache[f.callsign]?.route);
                        return (
                          <div key={f.icao} className="fids-row"
                            onClick={()=>onDetails(f)}>
                            <div className="fids-cs">{f.callsign||f.icao.toUpperCase()}</div>
                            <div className="fids-dest">← {orig?.iata||"?"} {orig?.city?.slice(0,10).toUpperCase()||""}</div>
                            <div className="fids-alt">{arr||feetAlt(f.alt)}</div>
                            <div className="fids-status arr">▼ ARR</div>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>
          );
        })}
        {visibleAirports.length===0&&(
          <div className="fids-none">NO AIRPORT DATA AVAILABLE</div>
        )}
      </div>
    </div>
  );
}

// ─── Overhead banner ──────────────────────────────────────────────────────────
function OverheadBanner({ flights, location, onSelect }) {
  const overhead=flights.filter(f=>f.lat&&f.lon&&haversine(location.lat,location.lon,f.lat,f.lon)<5);
  if (!overhead.length) return null;
  return (
    <div className="overhead-banner">
      <span className="overhead-label">✈ DIRECTLY OVERHEAD:</span>
      {overhead.map(f=>(
        <span key={f.icao} className="overhead-flight" onClick={()=>onSelect(f.icao)}>
          {f.callsign||f.icao.toUpperCase()} · {feetAlt(f.alt)}FT
        </span>
      ))}
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────
function Board({ location, onReset }) {
  const [flights,setFlights]         = useState([]);
  const [loading,setLoading]         = useState(true);
  const [fetching,setFetching]       = useState(false);
  const [paused,setPaused]           = useState(false);
  const [error,setError]             = useState(null);
  const [lastUpdate,setLastUpdate]   = useState(null);
  const [selectedId,setSelectedId]   = useState(null);
  const [detailFlight,setDetailFlight] = useState(null);
  const [clock,setClock]             = useState(new Date());
  const [rpct,setRpct]               = useState(0);
  const [routeCache,setRouteCache]   = useState({});
  const [filterAp,setFilterAp]       = useState(null);
  const [dimMode,setDimMode]         = useState(false);
  const [pingOn,setPingOn]           = useState(false);
  const [shareToast,setShareToast]   = useState(null);
  const prevLocalRef                 = useRef(new Set());
  const countRef                     = useRef(0);
  const DIST_NM=25, INTERVAL=30;

  const fetchFlights=useCallback(async()=>{
    if (paused) return;
    setFetching(true);
    try {
      const res=await fetch(`/api/flights?lat=${location.lat}&lon=${location.lon}&dist=${DIST_NM}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data=await res.json();
      const parsed=(data.ac||[])
        .filter(a=>a.lat!=null&&a.lon!=null)
        .map(a=>({
          icao:(a.hex||"??????").toLowerCase(),
          callsign:(a.flight||"").trim(),
          type:a.t||"",
          lat:parseFloat(a.lat),lon:parseFloat(a.lon),
          alt:a.alt_baro??a.alt_geom??null,
          speed:a.gs??null,track:a.track??null,
          vrate:a.baro_rate??a.geom_rate??null,
          squawk:a.squawk||"",
          miles:haversine(location.lat,location.lon,parseFloat(a.lat),parseFloat(a.lon)),
        }))
        .filter(f=>f.alt!=="ground"&&f.alt>0)
        .sort((a,b)=>a.miles-b.miles)
        .slice(0,25);
      setFlights(parsed);
      setLastUpdate(new Date());
      setError(null);
      if (pingOn) {
        const newLocal=parsed.filter(f=>f.alt&&f.alt<18000&&f.vrate&&Math.abs(f.vrate)>150);
        newLocal.forEach(f=>{if (!prevLocalRef.current.has(f.icao)) playPing();});
        prevLocalRef.current=new Set(newLocal.map(f=>f.icao));
      }
    } catch(e){setError(e.message);}
    finally{setLoading(false);setFetching(false);}
  },[location,paused,pingOn]);

  // Background route fetch
  useEffect(()=>{
    const candidates=flights
      .filter(f=>f.alt&&f.alt<18000&&f.vrate&&Math.abs(f.vrate)>150)
      .slice(0,12);
    candidates.forEach(f=>{
      if (!f.callsign||routeCache[f.callsign]!==undefined) return;
      setRouteCache(c=>({...c,[f.callsign]:null}));
      const p=new URLSearchParams({callsign:f.callsign,icao:f.icao});
      fetch(`/api/route?${p}`).then(r=>r.json())
        .then(d=>setRouteCache(c=>({...c,[f.callsign]:d})))
        .catch(()=>setRouteCache(c=>({...c,[f.callsign]:{}})));
    });
  },[flights]);

  useEffect(()=>{const t=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(t);},[]);

  useEffect(()=>{
    fetchFlights();
    countRef.current=0;setRpct(0);
    const bar=setInterval(()=>{
      if (!paused) {
        countRef.current+=1;
        setRpct((countRef.current/INTERVAL)*100);
        if (countRef.current>=INTERVAL){countRef.current=0;fetchFlights();}
      }
    },1000);
    return()=>clearInterval(bar);
  },[fetchFlights,paused]);

  const shareFlight=(icao,callsign)=>{
    const url=`${window.location.origin}?flight=${callsign||icao}`;
    navigator.clipboard?.writeText(url).then(()=>{
      setShareToast(`LINK COPIED: ${callsign||icao}`);
      setTimeout(()=>setShareToast(null),3000);
    });
  };

  const fmtC=d=>d.toLocaleTimeString("en-US",{hour12:false});
  const dotClass=paused?"sdot paused":fetching?"sdot fetching":error?"sdot err":"sdot live";
  const statusTxt=paused?"PAUSED":fetching?"UPDATING...":error?"ERROR":"LIVE";

  return (
    <div className="wall">
      {dimMode&&<div className="dim-overlay"/>}

      {/* Header */}
      <div className="hdr">
        <div className="hdr-left">
          <div className="logo" onClick={onReset}>✈ FLYBY.LIVE</div>
          <div className="location-badge">{location.city?.toUpperCase()||"YOUR LOCATION"}{location.state?`, ${location.state}`:""} · {DIST_NM}NM</div>
          <button className="hdr-btn" onClick={onReset}>CHANGE ZIP</button>
          <button className={`hdr-btn${paused?" pause active":""}`}
            onClick={()=>{setPaused(p=>!p);if(paused){countRef.current=0;fetchFlights();}}}>
            {paused?"▶ RESUME":"⏸ PAUSE"}
          </button>
          <button className={`hdr-btn${dimMode?" active":""}`} onClick={()=>setDimMode(d=>!d)}>
            {dimMode?"☀ BRIGHT":"🌙 DIM"}
          </button>
          <button className={`hdr-btn${pingOn?" active":""}`} onClick={()=>setPingOn(p=>!p)}>
            🔔{pingOn&&<span className="ping-dot"/>}
          </button>
        </div>
        <div className="hdr-right">
          <div className="clock">{fmtC(clock)}</div>
          <div className={dotClass}/>
          <span className="stxt">{statusTxt}</span>
          <span className="cbadge">{flights.length} AIRCRAFT</span>
        </div>
      </div>

      <div className="rbar">
        <div className={`rfill${paused?" paused":""}`} style={{width:`${paused?100:rpct}%`}}/>
      </div>
      {error&&<div className="errbanner">⚠ {error}</div>}

      {/* Overhead alert */}
      <OverheadBanner flights={flights} location={location} onSelect={setSelectedId}/>

      {/* Top 9 cards */}
      <FlightCards
        flights={flights}
        routeCache={routeCache}
        location={location}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDetails={setDetailFlight}
      />

      {/* Map */}
      <LiveMap
        location={location}
        flights={flights}
        nearbyAirports={location.nearbyAirports}
        selectedId={selectedId}
        onSelectAp={setFilterAp}
      />

      {/* Airport FIDS board */}
      <FidsBoard
        flights={flights}
        routeCache={routeCache}
        nearbyAirports={location.nearbyAirports}
        nearbyIata={location.nearbyIata}
        filterAp={filterAp}
        onFilterAp={setFilterAp}
        onDetails={setDetailFlight}
      />

      {lastUpdate&&(
        <div className="foot">
          <span>LAST UPDATE {lastUpdate.toLocaleTimeString()} · AUTO-REFRESH {INTERVAL}S</span>
          <span>· DATA: <a href="https://adsb.lol" target="_blank" rel="noopener noreferrer">ADSB.LOL</a></span>
          <span>· ROUTES: <a href="https://adsbdb.com" target="_blank" rel="noopener noreferrer">ADSBDB.COM</a></span>
          <span>· ROUTE DATA © DAVID TAYLOR &amp; JIM MASON (API USE ONLY)</span>
          <span>· MAP: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OPENSTREETMAP</a></span>
        </div>
      )}

      {/* Detail overlay */}
      {detailFlight&&(
        <DetailOverlay
          flight={detailFlight}
          routeInfo={detailFlight.callsign?routeCache[detailFlight.callsign]:null}
          onClose={()=>setDetailFlight(null)}
          onShare={shareFlight}
        />
      )}

      {shareToast&&<div className="share-toast">🔗 {shareToast}</div>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [location,setLocation]=useState(null);
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
