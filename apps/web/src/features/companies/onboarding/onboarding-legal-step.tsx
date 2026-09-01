import { Button } from "../../../components/ui/button";
import { InputField } from "../../../components/ui/form-field";
import { Banner } from "../../auth/banner";
import { ChannelTabs } from "../../auth/channel-tabs";
import {
  COMPANY_LEGAL_ADDRESS_MAX,
  COMPANY_LEGAL_BANK_MFO_MAX,
  COMPANY_LEGAL_BANK_NAME_MAX,
  COMPANY_LEGAL_EDRPOU_MAX,
  COMPANY_LEGAL_IBAN_MAX,
  COMPANY_LEGAL_NAME_MAX,
} from "./legal-form";
import { OnboardingShell } from "./onboarding-shell";
import { useOnboardingLegalStep } from "./use-onboarding-legal";

export function OnboardingLegalStep({
  onFinished,
}: {
  readonly onFinished: () => void;
}) {
  const model = useOnboardingLegalStep({ onFinished });

  return (
    <OnboardingShell
      step={2}
      copy={model.copy}
      title={model.copy.legalTitle}
      subtitle={model.copy.legalSubtitle}
      secondaryLabel={model.copy.legalSkip}
      onSecondary={model.skip}
      secondaryDisabled={model.pending}
    >
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          model.submit();
        }}
      >
        {/* Shell already wraps children with `mt-7`; OTP keeps default `mt-8`. */}
        <ChannelTabs
          className=""
          label={model.copy.typeLabel}
          tabs={[
            { key: "fop", label: model.copy.typeFop },
            { key: "tov", label: model.copy.typeTov },
          ]}
          selected={model.draft.companyType}
          disabled={!model.fieldsEditable}
          onSelect={(companyType) => {
            model.patch({ companyType });
          }}
        />

        <section className="flex flex-col gap-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
            {model.copy.companySection}
          </h2>
          <InputField
            id="onboarding-legal-name"
            label={model.copy.legalNameLabel}
            value={model.draft.legalName}
            placeholder={model.copy.legalNamePlaceholder}
            maxLength={COMPANY_LEGAL_NAME_MAX}
            disabled={!model.fieldsEditable}
            error={model.legalNameError}
            onChange={(legalName) => {
              model.patch({ legalName });
            }}
          />
          <InputField
            id="onboarding-legal-edrpou"
            label={model.copy.edrpouLabel}
            value={model.draft.edrpou}
            placeholder={model.copy.edrpouPlaceholder}
            inputMode="numeric"
            maxLength={COMPANY_LEGAL_EDRPOU_MAX}
            disabled={!model.fieldsEditable}
            error={model.edrpouError}
            onChange={(edrpou) => {
              model.patch({ edrpou });
            }}
          />
          <InputField
            id="onboarding-legal-address"
            label={model.copy.legalAddressLabel}
            value={model.draft.legalAddress}
            placeholder={model.copy.legalAddressPlaceholder}
            maxLength={COMPANY_LEGAL_ADDRESS_MAX}
            disabled={!model.fieldsEditable}
            error={model.legalAddressError}
            onChange={(legalAddress) => {
              model.patch({ legalAddress });
            }}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
            {model.copy.bankSection}
          </h2>
          <InputField
            id="onboarding-legal-iban"
            label={model.copy.ibanLabel}
            value={model.draft.iban}
            placeholder={model.copy.ibanPlaceholder}
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={COMPANY_LEGAL_IBAN_MAX}
            disabled={!model.fieldsEditable}
            error={model.ibanError}
            onChange={(iban) => {
              model.patch({ iban });
            }}
          />
          <InputField
            id="onboarding-legal-bank"
            label={model.copy.bankNameLabel}
            value={model.draft.bankName}
            placeholder={model.copy.bankNamePlaceholder}
            maxLength={COMPANY_LEGAL_BANK_NAME_MAX}
            disabled={!model.fieldsEditable}
            error={model.bankNameError}
            onChange={(bankName) => {
              model.patch({ bankName });
            }}
          />
          <InputField
            id="onboarding-legal-mfo"
            label={model.copy.bankMfoLabel}
            value={model.draft.bankMfo}
            placeholder={model.copy.bankMfoPlaceholder}
            inputMode="numeric"
            maxLength={COMPANY_LEGAL_BANK_MFO_MAX}
            disabled={!model.fieldsEditable}
            error={model.bankMfoError}
            onChange={(bankMfo) => {
              model.patch({ bankMfo });
            }}
          />
        </section>

        {model.banner ? <Banner message={model.banner} /> : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={model.submitDisabled}
        >
          {model.submitLabel}
        </Button>
      </form>
    </OnboardingShell>
  );
}
