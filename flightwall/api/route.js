// api/route.js
// Fetches flight route (origin + destination) AND aircraft details from adsbdb.com
// Free, no API key, returns full airport names, cities, and aircraft type info
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { callsign, icao } = req.query;
  if (!callsign && !icao) return res.status(400).json({ error: "callsign or icao required" });

  try {
    // Run both lookups in parallel — route by callsign, aircraft by ICAO hex
    const [routeRes, aircraftRes] = await Promise.allSettled([
      callsign
        ? fetch(`https://api.adsbdb.com/v0/callsign/${callsign.trim()}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(6000),
          })
        : Promise.resolve(null),
      icao
        ? fetch(`https://api.adsbdb.com/v0/aircraft/${icao.trim()}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(6000),
          })
        : Promise.resolve(null),
    ]);

    let route    = null;
    let aircraft = null;

    // Parse route
    if (routeRes.status === "fulfilled" && routeRes.value?.ok) {
      const data = await routeRes.value.json();
      const fr   = data?.response?.flightroute;
      if (fr) {
        route = {
          airline: fr.airline?.name || null,
          origin: fr.origin ? {
            iata:    fr.origin.iata_code,
            icao:    fr.origin.icao_code,
            name:    fr.origin.name,
            city:    fr.origin.municipality,
            country: fr.origin.country_name,
          } : null,
          destination: fr.destination ? {
            iata:    fr.destination.iata_code,
            icao:    fr.destination.icao_code,
            name:    fr.destination.name,
            city:    fr.destination.municipality,
            country: fr.destination.country_name,
          } : null,
        };
      }
    }

    // Parse aircraft
    if (aircraftRes.status === "fulfilled" && aircraftRes.value?.ok) {
      const data = await aircraftRes.value.json();
      const ac   = data?.response?.aircraft;
      if (ac) {
        aircraft = {
          type:         ac.type || null,
          icaoType:     ac.icao_type || null,
          manufacturer: ac.manufacturer || null,
          registration: ac.registration || null,
          owner:        ac.registered_owner || null,
          ownerCountry: ac.registered_owner_country_name || null,
          photoUrl:     ac.url_photo_thumbnail || ac.url_photo || null,
        };
      }
    }

    return res.status(200).json({ route, aircraft });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
