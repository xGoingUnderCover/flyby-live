// api/zip.js
// Converts a US zip code to lat/lon using the free zippopotam.us API
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { zip } = req.query;
  if (!zip) return res.status(400).json({ error: "zip required" });

  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) throw new Error("Invalid ZIP code");
    const data = await r.json();
    const place = data.places[0];
    return res.status(200).json({
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      city: place["place name"],
      state: place["state abbreviation"],
    });
  } catch (e) {
    return res.status(404).json({ error: "ZIP code not found" });
  }
}
