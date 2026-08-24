import { Redirect } from "expo-router";

/**
 * `/session` was the fnd-T49 signed-in stub URL and is still the target
 * of the sign-in redirects. The panel shell replaced the stub (SHO-122,
 * owner decision 1): the URL forwards to the tabs' initial route so it
 * never 404s; session identity now lives on the More tab.
 */
export default function SessionRedirect() {
  return <Redirect href="/orders" />;
}
