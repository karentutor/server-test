// utils/geocode.js
import geocodingClient from "./mapboxGeocoder.js";

export async function geocodeAddress({ address, city, postal_code, country }) {
  try {
    // Construct a query string from the components you have
    const query = [address, city, postal_code, country]
      .filter(Boolean)
      .join(", ");

    const response = await geocodingClient
      .forwardGeocode({
        query: query,
        limit: 1, // Limit to one best match
      })
      .send();

    console.log(response);

    const { features } = response.body;

    if (!features || features.length === 0) {
      console.error("No results found for address components:", {
        address,
        city,
        postal_code,
        country,
      });
      throw new Error("Could not geocode address. No matches found.");
    }

    // Mapbox returns features which contain geometry and properties
    return features;
  } catch (error) {
    console.error("Error geocoding address:", error);
    throw error;
  }
}

export async function reverseGeocodeCoordinates(latitude, longitude) {
  try {
    const response = await geocodingClient
      .reverseGeocode({
        query: [longitude, latitude], // Note order: [lng, lat]
        limit: 1,
      })
      .send();

    const { features } = response.body;

    if (!features || features.length === 0) {
      console.error("No results found for coordinates:", latitude, longitude);
      throw new Error(
        "Could not reverse geocode coordinates. No matches found."
      );
    }
    return features;
  } catch (error) {
    console.error("Error reverse geocoding coordinates:", error);
    throw error;
  }
}
