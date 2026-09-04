import { ChevronDown, ChevronLeft, Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Banner } from "../../auth/shared/banner";
import { Button } from "../../../components/ui/button";
import { cx } from "../../../components/ui/cx";
import { DetailStage } from "../../../components/ui/detail-stage";
import { TextareaField } from "../../../components/ui/form-field";
import { LeaveDialog } from "../../../components/ui/leave-dialog";
import { PaneHeader } from "../../../components/ui/pane-header";
import { detectLocale } from "../../../i18n/locale";
import {
  orderItemsInOrderLabel,
  orderVariantMetaLabel,
} from "../../../i18n/orders";
import { panelChromeCopy } from "../../../i18n/panel/chrome";
import {
  CREATE_ORDER_COMMENT_MAX,
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_PRODUCTS_QUERY_MAX,
  ORDER_COMMENT_LINES,
} from "../shared/order-caps";
import { CustomerIdentityCard } from "../shared/customer-identity-card";
import { OrderThumbnail } from "../shared/order-thumbnail";
import { OrdersSearchInput } from "../shared/orders-search-input";
import { PickerCheckCircle } from "../shared/picker-check";
import { OrdersSectionLabel } from "../shared/section-label";
import { OrderLineCard } from "./order-line-card";
import { isIdentityBlockedOnOrder } from "./product-picker";
import type { OrderCreateModel } from "./use-order-create";

export function OrderCreateView({
  model,
  showBack,
  onBack,
}: {
  readonly model: OrderCreateModel;
  readonly showBack: boolean;
  readonly onBack: () => void;
}) {
  const locale = detectLocale(
    typeof navigator === "undefined" ? "uk" : navigator.language,
  );
  const chromeCopy = panelChromeCopy(locale);
  const pickerOverlay = model.pickerOpen ? (
    <ProductPickerOverlay model={model} locale={locale} />
  ) : undefined;

  return (
    <>
      <DetailStage
        label={model.formCopy.title}
        className="flex h-full flex-col"
        overlay={pickerOverlay}
      >
        <PaneHeader
          title={
            <h2 className="text-inherit font-inherit">
              {model.formCopy.title}
            </h2>
          }
          menuLabel={chromeCopy.menu}
          backLabel={chromeCopy.backToList}
          onOpenNav={() => undefined}
          onBack={onBack}
          showMenu={false}
          showBack={showBack}
        />
        {model.loadState.kind === "permission" ? (
          <div className="px-6 py-14 text-center">
            <h2 className="text-[20px] font-semibold tracking-tight text-ink">
              {model.formCopy.permissionTitle}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {model.formCopy.permissionDescription}
            </p>
          </div>
        ) : null}
        {model.loadState.kind === "error" ? (
          <div className="px-6 py-10">
            <Banner message={model.formCopy.errors.unavailable} />
          </div>
        ) : null}
        {model.loadState.kind === "ready" ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              model.submit();
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {model.banner !== null ? (
                <div className="mb-4">
                  <Banner message={model.banner} />
                </div>
              ) : null}
              <CustomerPicker model={model} />
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <OrdersSectionLabel>
                    {model.formCopy.itemsTitle}
                  </OrdersSectionLabel>
                  {model.items.length > 0 ? (
                    <Button
                      type="button"
                      size="compact"
                      disabled={!model.fieldsEditable}
                      onClick={model.openPicker}
                    >
                      <Plus size={14} aria-hidden />
                      {model.formCopy.addProductsLabel}
                    </Button>
                  ) : null}
                </div>
                {model.itemsError !== null ? (
                  <p role="alert" className="mt-1 text-[12px] text-danger">
                    {model.itemsError}
                  </p>
                ) : null}
                {model.items.length === 0 ? (
                  <button
                    type="button"
                    disabled={!model.fieldsEditable}
                    onClick={model.openPicker}
                    className={cx(
                      "mt-3 flex w-full flex-col items-center justify-center rounded-card border border-dashed border-line bg-canvas px-4 py-8",
                      "text-[14px] font-medium text-muted",
                      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                      !model.fieldsEditable ? "opacity-40" : "hover:bg-surface",
                    )}
                  >
                    {model.formCopy.addProductsPlaceholder}
                  </button>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {model.items.map((item, index) => (
                      <OrderLineCard
                        key={item.key}
                        productName={item.productName}
                        variantName={item.variantName}
                        quantityLabel={item.quantityLabel}
                        editable={model.fieldsEditable}
                        thumbnailFileId={item.thumbnailFileId}
                        thumbnailUrl={item.thumbnailUrl}
                        thumbnailFailed={item.thumbnailFailed}
                        copy={model.formCopy}
                        onCommitUnits={(units) => {
                          model.setQuantityUnits(index, units);
                        }}
                        onRemove={() => {
                          model.removeItem(index);
                        }}
                      />
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-6">
                <OrdersSectionLabel>
                  {model.formCopy.commentTitle}
                </OrdersSectionLabel>
                <div className="mt-2">
                  <TextareaField
                    id="order-create-comment"
                    label={model.formCopy.commentLabel}
                    value={model.comment}
                    placeholder={model.formCopy.commentPlaceholder}
                    rows={ORDER_COMMENT_LINES}
                    maxLength={CREATE_ORDER_COMMENT_MAX}
                    disabled={!model.fieldsEditable}
                    error={model.commentError}
                    onChange={model.changeComment}
                  />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 border-t border-line bg-surface p-3 sm:p-4">
              {model.items.length > 0 ? (
                <p className="mb-3 text-center text-[13px] text-muted">
                  {orderItemsInOrderLabel(
                    model.copy,
                    locale,
                    model.items.length,
                  )}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={model.pending}
                  onClick={onBack}
                >
                  {model.formCopy.cancel}
                </Button>
                {model.showSubmit ? (
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={model.submitDisabled}
                    onClick={(event) => {
                      event.preventDefault();
                      model.submit();
                    }}
                  >
                    {model.submitLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        ) : null}
      </DetailStage>
      <LeaveDialog
        open={model.leaveOpen}
        title={model.formCopy.leaveTitle}
        description={model.formCopy.leaveDescription}
        stayLabel={model.formCopy.leaveContinue}
        leaveLabel={model.formCopy.leaveConfirm}
        onStay={model.stay}
        onLeave={model.leave}
      />
    </>
  );
}

function CustomerPicker({ model }: { readonly model: OrderCreateModel }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!model.customerOpen) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      const node = event.target;
      if (node instanceof Node && rootRef.current?.contains(node)) {
        return;
      }
      model.setCustomerOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
    };
  }, [model.customerOpen, model.setCustomerOpen]);

  return (
    <div ref={rootRef} className="relative">
      <OrdersSectionLabel>{model.formCopy.customerTitle}</OrdersSectionLabel>
      <button
        type="button"
        aria-expanded={model.customerOpen}
        aria-haspopup="listbox"
        disabled={!model.fieldsEditable}
        aria-invalid={model.customerError !== null ? "true" : undefined}
        onClick={() => {
          model.setCustomerOpen(!model.customerOpen);
        }}
        className={cx(
          "mt-2 flex w-full items-center rounded-card bg-canvas px-3 py-2.5 text-left shadow-card",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
          model.customerError !== null ? "ring-1 ring-danger" : false,
          !model.fieldsEditable ? "opacity-40" : false,
        )}
      >
        <CustomerIdentityCard
          name={model.customerName.length > 0 ? model.customerName : null}
          phone={model.customerPhone}
          placeholder={model.formCopy.customerPlaceholder}
          trailing={
            <ChevronDown
              size={18}
              className="shrink-0 text-faint"
              aria-hidden
            />
          }
        />
      </button>
      {model.customerError !== null ? (
        <p role="alert" className="mt-1 text-[12px] text-danger">
          {model.customerError}
        </p>
      ) : null}
      {model.customerOpen ? (
        <div className="absolute z-20 mt-1 w-full rounded-card border border-line bg-surface p-2 shadow-card">
          <OrdersSearchInput
            id="order-create-customer-search"
            label={model.formCopy.customerSearchLabel}
            value={model.customerQuery}
            maxLength={LIST_CUSTOMERS_SEARCH_MAX}
            placeholder={model.formCopy.customerSearchPlaceholder}
            bordered={false}
            onChange={model.setCustomerQuery}
          />
          <ul role="listbox" className="mt-2 max-h-56 overflow-y-auto">
            {model.customersLoading ? (
              <li className="px-3 py-3 text-[14px] text-muted">
                {model.copy.loadingLabel}
              </li>
            ) : null}
            {!model.customersLoading && model.customersError !== null ? (
              <li className="px-3 py-3">
                <Banner message={model.customersError} />
                <button
                  type="button"
                  onClick={model.retryCustomers}
                  className="mt-2 text-[14px] font-medium text-action focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
                >
                  {model.formCopy.lookupRetry}
                </button>
              </li>
            ) : null}
            {!model.customersLoading &&
            model.customersError === null &&
            model.customers.length === 0 ? (
              <li className="px-3 py-3 text-[14px] text-muted">
                {model.formCopy.emptyCustomers}
              </li>
            ) : null}
            {model.customersError === null
              ? model.customers.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={customer.id === model.customerId}
                      onClick={() => {
                        model.pickCustomer(customer);
                      }}
                      className={cx(
                        "flex w-full rounded-field px-2 py-2 text-left",
                        "hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                        customer.id === model.customerId
                          ? "bg-actionSoft"
                          : false,
                      )}
                    >
                      <CustomerIdentityCard
                        name={customer.name}
                        phone={customer.phone}
                        size="sm"
                      />
                    </button>
                  </li>
                ))
              : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProductPickerOverlay({
  model,
  locale,
}: {
  readonly model: OrderCreateModel;
  readonly locale: "en" | "uk";
}) {
  const variants = model.pickerKind === "variants";
  const title = variants
    ? (model.pickerProductName ?? model.formCopy.productSheetTitle)
    : model.formCopy.productSheetTitle;
  const closeLabel = variants
    ? model.formCopy.variantsBackLabel
    : model.formCopy.productSheetClose;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-2.5 sm:px-3">
        <button
          type="button"
          aria-label={closeLabel}
          onClick={variants ? model.closeVariants : model.closePicker}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
        >
          {variants ? (
            <ChevronLeft size={20} aria-hidden />
          ) : (
            <X size={20} aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1 px-1 text-center text-[16px] font-semibold tracking-tight text-ink sm:text-[17px]">
          {title}
        </div>
        <span className="h-10 w-10 shrink-0" aria-hidden />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {variants ? (
          <VariantList model={model} />
        ) : (
          <ProductList model={model} locale={locale} />
        )}
      </div>
      <div className="sticky bottom-0 border-t border-line bg-surface p-3 sm:p-4">
        {model.pickerPickCount === 0 ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={model.closePicker}
          >
            {model.formCopy.productSheetClose}
          </Button>
        ) : (
          <Button type="button" className="w-full" onClick={model.commitPicker}>
            {model.pickerAddLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function ProductList({
  model,
  locale,
}: {
  readonly model: OrderCreateModel;
  readonly locale: "en" | "uk";
}) {
  return (
    <>
      <OrdersSearchInput
        id="order-create-product-search"
        label={model.formCopy.productSearchLabel}
        value={model.productQuery}
        maxLength={LIST_PRODUCTS_QUERY_MAX}
        placeholder={model.formCopy.productSearchPlaceholder}
        onChange={model.setProductQuery}
      />
      <ul className="mt-3">
        {model.productsLoading ? (
          <li className="py-3 text-[14px] text-muted">
            {model.copy.loadingLabel}
          </li>
        ) : null}
        {!model.productsLoading && model.productsError !== null ? (
          <li className="py-3">
            <Banner message={model.productsError} />
            <button
              type="button"
              onClick={model.retryProducts}
              className="mt-2 text-[14px] font-medium text-action focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
            >
              {model.formCopy.lookupRetry}
            </button>
          </li>
        ) : null}
        {!model.productsLoading &&
        model.productsError === null &&
        model.products.length === 0 ? (
          <li className="py-3 text-[14px] text-muted">
            {model.formCopy.emptyProducts}
          </li>
        ) : null}
        {model.productsError === null
          ? model.products.map((product) => {
              const hasVariants = product.variantCount > 0;
              const selected = model.pickerSelectedIds.has(product.id);
              const blocked =
                !hasVariants &&
                isIdentityBlockedOnOrder(
                  model.existingLineKeys,
                  product.id,
                  null,
                  model.pickerPicks,
                );
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    aria-label={product.name}
                    aria-pressed={hasVariants ? undefined : selected}
                    disabled={blocked}
                    onClick={() => {
                      if (hasVariants) {
                        model.openVariants(product.id, product.name);
                        return;
                      }
                      model.toggleSimpleProduct(product.id, product.name);
                    }}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-field px-3 py-3 text-left",
                      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                      blocked ? "opacity-40" : "hover:bg-canvas",
                    )}
                  >
                    <OrderThumbnail
                      fileId={product.thumbnailFileId}
                      url={product.thumbnailUrl}
                      failed={product.thumbnailFailed}
                      failedLabel={model.formCopy.thumbnailUnavailable}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-ink">
                        {product.name}
                      </span>
                      <span className="text-[12px] text-muted" aria-hidden>
                        {orderVariantMetaLabel(
                          model.copy,
                          locale,
                          product.variantCount,
                        )}
                      </span>
                    </span>
                    {hasVariants ? null : (
                      <PickerCheckCircle checked={selected} />
                    )}
                  </button>
                </li>
              );
            })
          : null}
      </ul>
    </>
  );
}

function VariantList({ model }: { readonly model: OrderCreateModel }) {
  if (model.variantsLoading) {
    return (
      <p className="py-3 text-[14px] text-muted">
        {model.formCopy.variantsLoading}
      </p>
    );
  }
  if (model.variantsError) {
    return (
      <p className="py-3 text-[14px] text-danger">
        {model.formCopy.variantsError}
      </p>
    );
  }
  if (model.variants.length === 0) {
    return (
      <p className="py-3 text-[14px] text-muted">
        {model.formCopy.emptyVariants}
      </p>
    );
  }
  return (
    <ul>
      {model.variants.map((variant) => {
        const selected = model.pickerSelectedVariantIds.has(variant.id);
        const productId = model.pickerProductId ?? "";
        const blocked = isIdentityBlockedOnOrder(
          model.existingLineKeys,
          productId,
          variant.id,
          model.pickerPicks,
        );
        return (
          <li key={variant.id}>
            <button
              type="button"
              aria-label={variant.name}
              aria-pressed={selected}
              disabled={blocked}
              onClick={() => {
                model.pickVariant(variant.id, variant.name);
              }}
              className={cx(
                "flex w-full items-center gap-3 rounded-field px-3 py-3 text-left",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                blocked ? "opacity-40" : "hover:bg-canvas",
              )}
            >
              <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">
                {variant.name}
              </span>
              <PickerCheckCircle checked={selected} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
