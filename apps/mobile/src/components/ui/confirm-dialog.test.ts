import { describe, expect, it } from "vitest";

import { confirmDialogAlertButtons } from "./confirm-dialog";

describe("confirmDialogAlertButtons", () => {
  const base = {
    title: "Архівувати товар?",
    message: "Товар зникне з продажу.",
    confirmLabel: "Архівувати товар",
    cancelLabel: "Скасувати",
  };

  it("marks a danger confirm as the iOS destructive button", () => {
    expect(confirmDialogAlertButtons({ ...base, tone: "danger" })).toEqual({
      cancel: { text: "Скасувати", style: "cancel" },
      confirm: { text: "Архівувати товар", style: "destructive" },
    });
  });

  it("keeps restore (and other non-danger) confirms as the default button", () => {
    expect(confirmDialogAlertButtons(base)).toEqual({
      cancel: { text: "Скасувати", style: "cancel" },
      confirm: { text: "Архівувати товар", style: "default" },
    });
  });
});
