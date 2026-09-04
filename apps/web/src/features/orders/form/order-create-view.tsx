import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Banner } from "../../auth/shared/banner";
import { Button } from "../../../components/ui/button";
import { cx } from "../../../components/ui/cx";
import { DetailStage } from "../../../components/ui/detail-stage";
import { TextareaField } from "../../../components/ui/form-field";
import { LeaveDialog } from "../../../components/ui/leave-dialog";
import { PaneHeader } from "../../../components/ui/pane-header";
import { detectLocale } from "../../../i18n/locale";
import { panelChromeCopy } from "../../../i18n/panel/chrome";
import {
  CREATE_ORDER_COMMENT_MAX,
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_PRODUCTS_QUERY_MAX,
  ORDER_COMMENT_LINES,
} from "../shared/order-caps";
import { OrderThumbnail } from "../shared/order-thumbnail";
import { OrderLineCard } from "./order-line-card";
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
  const chromeCopy = panelChromeCopy(
    detectLocale(typeof navigator === "undefined" ? "uk" : navigator.language),
  );
  const pickerOverlay = model.pickerOpen ? (
    <ProductPickerOverlay model={model} backLabel={chromeCopy.backToList} />
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
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {model.banner !== null ? (
                <div className="mb-4">
                  <Banner message={model.banner} />
                </div>
              ) : null}
              <CustomerPicker model={model} />
              <div className="mt-6">
                <h3 className="text-[13px] font-medium text-muted">
                  {model.formCopy.itemsTitle}
                </h3>
                {model.itemsError !== null ? (
                  <p role="alert" className="mt-1 text-[12px] text-danger">
                    {model.itemsError}
                  </p>
                ) : null}
                <ul className="mt-2 divide-y divide-line">
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
                      onStep={(delta) => {
                        model.stepQuantity(index, delta);
                      }}
                      onRemove={() => {
                        model.removeItem(index);
                      }}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!model.fieldsEditable}
                  onClick={model.openPicker}
                  className="mt-3 text-[14px] font-medium text-action focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
                >
                  {model.items.length === 0
                    ? model.formCopy.addProductsPlaceholder
                    : model.formCopy.addProductsLabel}
                </button>
              </div>
              <div className="mt-6">
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
            <div className="sticky bottom-0 border-t border-line bg-surface px-6 py-4">
              <div className="flex gap-2">
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

  const triggerLabel =
    model.customerName.length > 0
      ? model.customerName
      : model.formCopy.customerPlaceholder;

  return (
    <div ref={rootRef} className="relative">
      <p className="text-[13px] text-muted">{model.formCopy.customerLabel}</p>
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
          "mt-1 w-full rounded-card border bg-canvas px-3 py-2.5 text-left text-[15px]",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
          model.customerError !== null
            ? "border-danger text-ink"
            : "border-line",
          model.customerName.length > 0 ? "text-ink" : "text-faint",
          !model.fieldsEditable ? "opacity-40" : false,
        )}
      >
        {triggerLabel}
      </button>
      {model.customerError !== null ? (
        <p role="alert" className="mt-1 text-[12px] text-danger">
          {model.customerError}
        </p>
      ) : null}
      {model.customerOpen ? (
        <div className="absolute z-20 mt-1 w-full rounded-card border border-line bg-surface p-2 shadow-card">
          <label className="sr-only" htmlFor="order-create-customer-search">
            {model.formCopy.customerSearchLabel}
          </label>
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              id="order-create-customer-search"
              type="search"
              value={model.customerQuery}
              maxLength={LIST_CUSTOMERS_SEARCH_MAX}
              placeholder={model.formCopy.customerSearchPlaceholder}
              onChange={(event) => {
                model.setCustomerQuery(event.target.value);
              }}
              className="w-full rounded-card border border-line bg-canvas py-2 pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
            />
          </div>
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
                        "flex w-full flex-col rounded-field px-3 py-2 text-left",
                        "hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                        customer.id === model.customerId
                          ? "bg-actionSoft"
                          : false,
                      )}
                    >
                      <span className="text-[15px] font-medium text-ink">
                        {customer.name}
                      </span>
                      {customer.phone !== null ? (
                        <span className="text-[13px] text-muted">
                          {customer.phone}
                        </span>
                      ) : null}
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
  backLabel,
}: {
  readonly model: OrderCreateModel;
  readonly backLabel: string;
}) {
  const variants = model.pickerKind === "variants";
  return (
    <div className="flex min-h-full flex-col">
      <PaneHeader
        title={
          <h2 className="text-inherit font-inherit">
            {variants
              ? (model.pickerProductName ?? model.formCopy.productSheetTitle)
              : model.formCopy.productSheetTitle}
          </h2>
        }
        menuLabel=""
        backLabel={variants ? model.formCopy.variantsBackLabel : backLabel}
        onOpenNav={() => undefined}
        onBack={variants ? model.closeVariants : model.closePicker}
        showMenu={false}
        showBack
        trailing={
          <button
            type="button"
            aria-label={model.formCopy.cancel}
            onClick={model.closePicker}
            className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
          >
            <X size={20} aria-hidden />
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {variants ? (
          <VariantList model={model} />
        ) : (
          <ProductList model={model} />
        )}
      </div>
      <div className="sticky bottom-0 border-t border-line bg-surface px-6 py-4">
        <Button type="button" className="w-full" onClick={model.commitPicker}>
          {model.pickerDoneLabel}
        </Button>
      </div>
    </div>
  );
}

function ProductList({ model }: { readonly model: OrderCreateModel }) {
  return (
    <>
      <label className="sr-only" htmlFor="order-create-product-search">
        {model.formCopy.productSearchLabel}
      </label>
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          id="order-create-product-search"
          type="search"
          value={model.productQuery}
          maxLength={LIST_PRODUCTS_QUERY_MAX}
          placeholder={model.formCopy.productSearchPlaceholder}
          onChange={(event) => {
            model.setProductQuery(event.target.value);
          }}
          className="w-full rounded-card border border-line bg-canvas py-2 pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
        />
      </div>
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
              const selected = model.pickerSelectedIds.has(product.id);
              const hasVariants = product.variantCount > 0;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    aria-pressed={hasVariants ? undefined : selected}
                    onClick={() => {
                      if (hasVariants) {
                        model.openVariants(product.id, product.name);
                        return;
                      }
                      model.toggleSimpleProduct(product.id, product.name);
                    }}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-field px-3 py-3 text-left",
                      "hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                      selected ? "bg-actionSoft" : false,
                    )}
                  >
                    <OrderThumbnail
                      fileId={product.thumbnailFileId}
                      url={product.thumbnailUrl}
                      failed={product.thumbnailFailed}
                      failedLabel={model.formCopy.thumbnailUnavailable}
                    />
                    <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">
                      {product.name}
                    </span>
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
        return (
          <li key={variant.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => {
                model.pickVariant(variant.id, variant.name);
              }}
              className={cx(
                "flex w-full items-center justify-between rounded-field px-3 py-3 text-left",
                "hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                selected ? "bg-actionSoft" : false,
              )}
            >
              <span className="text-[15px] font-medium text-ink">
                {variant.name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
