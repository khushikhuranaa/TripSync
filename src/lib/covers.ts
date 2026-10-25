export const tripCovers = [
  {
    value: "/images/goa-palolem.jpg",
    label: "Palm-lined beach",
    alt: "Palm trees and fishing boats along Palolem beach in south Goa",
  },
  {
    value: "/images/jaipur-hawa-mahal.jpg",
    label: "Pink city palace",
    alt: "The pink sandstone facade of Hawa Mahal in Jaipur",
  },
  {
    value: "/images/kerala-houseboat.jpg",
    label: "Backwater houseboat",
    alt: "A traditional thatched houseboat moored on the Kerala backwaters",
  },
  {
    value: "/images/coorg-hills.jpg",
    label: "Green hill country",
    alt: "Green paddy fields and forested hills in Coorg, Karnataka",
  },
  {
    value: "/images/manali-mountains.jpg",
    label: "Himalayan peaks",
    alt: "Snow-covered Himalayan peaks above Manali in Himachal Pradesh",
  },
] as const;

export function coverForDestination(destination: string) {
  const value = destination.toLowerCase();
  if (value.includes("goa") || value.includes("beach")) return tripCovers[0];
  if (
    value.includes("jaipur") ||
    value.includes("udaipur") ||
    value.includes("rajasthan") ||
    value.includes("leh")
  ) {
    return tripCovers[1];
  }
  if (value.includes("kerala") || value.includes("kochi")) return tripCovers[2];
  if (value.includes("manali") || value.includes("himachal") || value.includes("ladakh")) {
    return tripCovers[4];
  }
  return tripCovers[3];
}

export function coverForValue(value: string | undefined, destination: string) {
  const match = tripCovers.find((cover) => cover.value === value);
  return match ?? coverForDestination(destination);
}
