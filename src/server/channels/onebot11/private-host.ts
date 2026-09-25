/** Compatibility import for integrations migrating from PR2; there is one Bot host implementation. */
export { OneBotHost as OneBotPrivateHost } from "./bot-host";
export type {
  OneBotHostOptions as OneBotPrivateHostOptions,
  OneBotPolicy as OneBotPrivatePolicy,
} from "./bot-host";
