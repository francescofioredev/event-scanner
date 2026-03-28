import { createStubProvider } from "@/sources/types";
import type { EventCard } from "@/types";
import rawEvents from "@/data/events-mockup.json";

const DEMO_EVENTS = rawEvents as Partial<EventCard>[];

export default createStubProvider("mock", DEMO_EVENTS);
