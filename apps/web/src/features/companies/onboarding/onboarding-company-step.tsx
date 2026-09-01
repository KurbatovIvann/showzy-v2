import { Button } from "../../../components/ui/button";
import { InputField } from "../../../components/ui/form-field";
import { slugPreviewCopy } from "../../../i18n/companies/onboarding";
import { Banner } from "../../auth/banner";
import type { CompanyMembership } from "../api/list-mine";
import { COMPANY_NAME_MAX, COMPANY_SLUG_MAX } from "./create-company-form";
import { OnboardingShell } from "./onboarding-shell";
import { useCreateCompanyStep } from "./use-create-company";

export function OnboardingCompanyStep({
  onCreated,
}: {
  readonly onCreated: (membership: CompanyMembership) => void;
}) {
  const model = useCreateCompanyStep({ onCreated });

  return (
    <OnboardingShell
      step={1}
      copy={model.copy}
      title={model.copy.companyTitle}
      subtitle={model.copy.companySubtitle}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          model.submit();
        }}
      >
        <InputField
          id="onboarding-company-name"
          label={model.copy.nameLabel}
          value={model.name}
          placeholder={model.copy.namePlaceholder}
          autoComplete="organization"
          maxLength={COMPANY_NAME_MAX}
          disabled={!model.fieldsEditable}
          error={model.nameError}
          onChange={model.changeName}
        />
        <InputField
          id="onboarding-company-slug"
          label={model.copy.slugLabel}
          value={model.slug}
          placeholder={model.copy.slugPlaceholder}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={COMPANY_SLUG_MAX}
          disabled={!model.fieldsEditable}
          error={model.slugError}
          hint={slugPreviewCopy(model.copy, model.slug)}
          onChange={model.changeSlug}
        />
        {model.banner ? <Banner message={model.banner} /> : null}
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={model.submitDisabled}
        >
          {model.submitLabel}
        </Button>
      </form>
    </OnboardingShell>
  );
}
