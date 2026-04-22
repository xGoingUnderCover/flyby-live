// api/airports.js
// Returns airports within radius miles of a lat/lon
// Uses the free, open ourairports.com dataset (no key needed)
// We fetch a lightweight filtered version and find nearby ones

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { lat, lon, radius = 75 } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat and lon required" });

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radiusMi = parseFloat(radius);

  try {
    // Fetch the ourairports.com CSV - free, open, comprehensive
    const r = await fetch(
      "https://davidmegginson.github.io/ourairports-data/airports.csv",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) throw new Error(`ourairports returned ${r.status}`);
    const csv = await r.text();

    // Parse CSV - only care about medium and large airports with IATA codes
    const lines = csv.split("\n");
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());

    const idIdx       = headers.indexOf("id");
    const typeIdx     = headers.indexOf("type");
    const nameIdx     = headers.indexOf("name");
    const latIdx      = headers.indexOf("latitude_deg");
    const lonIdx      = headers.indexOf("longitude_deg");
    const iataIdx     = headers.indexOf("iata_code");
    const icaoIdx     = headers.indexOf("ident");
    const muniIdx     = headers.indexOf("municipality");

    const nearby = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Simple CSV parse (handles quoted fields)
      const cols = [];
      let cur = "", inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      cols.push(cur.trim());

      const type = cols[typeIdx] || "";
      // Only medium_airport and large_airport with valid IATA codes
      if (type !== "medium_airport" && type !== "large_airport") continue;
      const iata = cols[iataIdx]?.replace(/"/g, "").trim();
      if (!iata || iata.length !== 3) continue;

      const apLat = parseFloat(cols[latIdx]);
      const apLon = parseFloat(cols[lonIdx]);
      if (isNaN(apLat) || isNaN(apLon)) continue;

      const dist = haversine(userLat, userLon, apLat, apLon);
      if (dist > radiusMi) continue;

      nearby.push({
        iata,
        icao:  cols[icaoIdx]?.replace(/"/g, "").trim() || "",
        name:  cols[nameIdx]?.replace(/"/g, "").trim() || "",
        city:  cols[muniIdx]?.replace(/"/g, "").trim() || "",
        lat:   apLat,
        lon:   apLon,
        dist:  Math.round(dist),
        type,
      });
    }

    nearby.sort((a, b) => a.dist - b.dist);

    return res.status(200).json({
      airports: nearby,
      iata_codes: nearby.map(a => a.iata),
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

