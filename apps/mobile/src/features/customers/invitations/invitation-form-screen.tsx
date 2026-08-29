import { InvitationFormView } from "./invitation-form-view";
import { useInvitationForm } from "./use-invitation-form";

export function InvitationCreateScreen() {
  const model = useInvitationForm();
  return <InvitationFormView {...model} />;
}
