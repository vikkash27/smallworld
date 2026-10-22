import { cronJobs, makeFunctionReference } from "convex/server";
const crons = cronJobs();
crons.interval(
  "Expire staged WhatsApp messages",
  { minutes: 1 },
  makeFunctionReference<"mutation">("whatsapp/functions:cleanup"),
  {},
);
export default crons;
