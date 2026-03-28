import { createStubProvider } from "@/sources/types";

// Example stub provider — copy this file and rename to add a new synthetic data source.
// Register it in src/sources/index.ts to activate it.
export default createStubProvider("mock", [
  {
    id: "stub-001",
    title: "AI Product Summit (stub)",
    date: "May 15, 2025",
    location: "Milan, Italy",
    format: "conference",
    price: "paid",
    priceAmount: 99,
    currency: "EUR",
    topics: ["AI", "Product"],
    attendeeProfile: "Product managers and AI practitioners",
    source: "mock",
    url: undefined,
  },
  {
    id: "stub-002",
    title: "Open Source Meetup Milan (stub)",
    date: "May 22, 2025",
    location: "Milan, Italy",
    format: "meetup",
    price: "free",
    topics: ["Open Source", "Community"],
    attendeeProfile: "Developers and open-source contributors",
    source: "mock",
    url: undefined,
  },
]);
