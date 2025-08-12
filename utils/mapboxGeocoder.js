// utils/mapboxGeocoder.js
import mbxGeocoding from "@mapbox/mapbox-sdk/services/geocoding.js";

const geocodingClient = mbxGeocoding({
  accessToken: process.env.MAPBOX_TOKEN,
});

export default geocodingClient;
