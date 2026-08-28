export function customerCreateHref(): string {
  return "/customers/clients/new";
}

export function customerEditorHref(customerId: string): string {
  return `/customers/clients/${customerId}/edit`;
}

export function groupCreateHref(): string {
  return "/customers/groups/new";
}

export function groupEditorHref(groupId: string): string {
  return `/customers/groups/${groupId}/edit`;
}
