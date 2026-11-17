/**
 * Here Happened brand tokens. Read by the UI (globals.css mirrors these) and by the
 * share-image helper. Art direction: a survey atlas / archival field guide — cool
 * survey paper, ink, a sea-chart blue for water and one "marker red" for the pin.
 */
export const brand = {
  wordmark: "Here Happened",
  tagline: "The history of any place on Earth",
  fonts: {
    /** Display + quotations: a reading serif with optical sizes. */
    display: "Newsreader",
    /** UI, labels, figures: Highway Gothic descendant, the type of road signs and maps. */
    ui: "Overpass",
  },
  light: {
    paper: "#F2F1EC", // ground
    paperDeep: "#E6E4DB", // one tone step down (surfaces, chips, space around the globe)
    land: "#F6F5F0", // map land (lighter than the page, like a printed globe)
    water: "#BCCFD6", // map water (sea-chart blue)
    park: "#DCE2CF", // map green
    road: "#DCD7CA", // map roads (drawn in pencil grey)
    boundary: "#B9B5A8",
    ink: "#1A1D21", // text
    inkSoft: "#555A60", // secondary text
    accent: "#C62F2A", // marker red: the pin, the action, the "here"
    accentInk: "#FFFFFF",
  },
  dark: {
    paper: "#121518",
    paperDeep: "#1C2125",
    land: "#171B1F",
    water: "#0C1A20",
    park: "#18211C",
    road: "#323A41",
    boundary: "#3A4148",
    ink: "#ECE9E1",
    inkSoft: "#A3A8AD",
    accent: "#FF6A55",
    accentInk: "#121518",
  },
} as const;

export type Brand = typeof brand;
export default brand;
