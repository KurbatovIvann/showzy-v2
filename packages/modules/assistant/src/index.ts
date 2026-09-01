import { appendUserMessage } from "./actions/append-user-message.js";
import { createConversation } from "./actions/create-conversation.js";
import { getConversation } from "./actions/get-conversation.js";
import { getStaffActor } from "./actions/get-staff-actor.js";
import { listConversations } from "./actions/list-conversations.js";
import { recordAssistantTurn } from "./actions/record-assistant-turn.js";

export { appendUserMessage };
export { createConversation };
export { getConversation };
export { getStaffActor };
export { listConversations };
export { recordAssistantTurn };

export const assistantActions = [
  createConversation,
  listConversations,
  getConversation,
  appendUserMessage,
  recordAssistantTurn,
  getStaffActor,
] as const;
