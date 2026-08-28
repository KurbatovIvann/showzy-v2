import { describe, expect, it } from "vitest";

import { detectLocale } from "./locale";
import { customersCopy } from "./customers";

describe("customers copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(customersCopy(detectLocale()).title).toBe("Клієнти");
    expect(customersCopy(detectLocale("en-GB")).title).toBe("Customers");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = customersCopy("uk");
    const en = customersCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.tabs)).toEqual(Object.keys(en.tabs));
    expect(Object.keys(uk.filters)).toEqual(Object.keys(en.filters));
    expect(Object.keys(uk.empty)).toEqual(Object.keys(en.empty));
    expect(Object.keys(uk.comingSoon)).toEqual(Object.keys(en.comingSoon));
    expect(Object.keys(uk.confirm)).toEqual(Object.keys(en.confirm));
    expect(Object.keys(uk.confirm.deleteGroupDescription)).toEqual(
      Object.keys(en.confirm.deleteGroupDescription),
    );
    expect(Object.keys(uk.mutation)).toEqual(Object.keys(en.mutation));
    expect(Object.keys(uk.editorStub)).toEqual(Object.keys(en.editorStub));
    expect(Object.keys(uk.counterparties)).toEqual(
      Object.keys(en.counterparties),
    );
    expect(Object.keys(uk.members)).toEqual(Object.keys(en.members));
  });

  it("pins the canvas clients-list copy in uk", () => {
    const uk = customersCopy("uk");
    expect(uk.searchLabel).toBe("Пошук");
    expect(uk.clientsSearchPlaceholder).toBe("Ім’я, телефон або email");
    expect(uk.groupsSearchPlaceholder).toBe("Назва групи");
    expect(uk.createClientLabel).toBe("Новий клієнт");
    expect(uk.createGroupLabel).toBe("Нова група");
    expect(uk.tabs).toEqual({
      clients: "Клієнти",
      groups: "Групи",
      counterparties: "Контрагенти",
      invitations: "Запрошення",
    });
    expect(uk.filters).toEqual({ all: "Усі", archived: "Архів" });
    expect(uk.archivedBadge).toBe("В архіві");
    expect(uk.editLabel).toBe("Редагувати");
    expect(uk.restoreLabel).toBe("Відновити");
    expect(uk.empty.catalogTitle).toBe("Клієнтів ще немає");
    expect(uk.empty.archivedTitle).toBe("Архів порожній");
    expect(uk.empty.archivedDescription).toContain("Спочатку архів");
    expect(uk.empty.groupsTitle).toBe("Груп ще немає");
    expect(uk.confirm.archiveDescription).toContain(
      "Спочатку архів, потім видалення",
    );
    expect(uk.confirm.deleteDescription).toContain(
      "Контрагенти залишаться без прив’язки",
    );
    expect(uk.confirm.deleteGroupDescription.many).toContain("{{count}}");
    expect(uk.confirm.deleteGroupDescription.one).toContain("клієнт");
  });
});
