import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";

type ProbeProps = {
  readonly value: string;
  readonly delayMs: number;
  readonly latest: { current: string };
};

function Probe({ value, delayMs, latest }: ProbeProps) {
  latest.current = useDebouncedValue(value, delayMs);
  return null;
}

class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;

  addEventListener(): void {}
  removeEventListener(): void {}

  appendChild(child: FakeNode): FakeNode {
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child: FakeNode): FakeNode {
    this.childNodes = this.childNodes.filter((node) => node !== child);
    child.parentNode = null;
    return child;
  }

  insertBefore(child: FakeNode, before: FakeNode | null): FakeNode {
    if (!before) {
      return this.appendChild(child);
    }
    const index = this.childNodes.indexOf(before);
    this.childNodes.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }
}

class FakeElement extends FakeNode {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly nodeName: string;
  readonly style: Record<string, string> = {};
  readonly ownerDocument: FakeDocument;
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";

  constructor(tagName: string, ownerDocument: FakeDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.ownerDocument = ownerDocument;
  }

  setAttribute(): void {}
  removeAttribute(): void {}
  getAttribute(): null {
    return null;
  }

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get lastChild(): FakeNode | null {
    return this.childNodes.at(-1) ?? null;
  }

  get textContent(): string {
    return "";
  }

  set textContent(_value: string) {
    this.childNodes.length = 0;
  }
}

class FakeDocument extends FakeNode {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  readonly documentElement: FakeElement;
  readonly head: FakeElement;
  readonly body: FakeElement;
  activeElement: FakeElement | null = null;
  readonly defaultView = globalThis;

  constructor() {
    super();
    this.documentElement = new FakeElement("html", this);
    this.head = new FakeElement("head", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }

  createElementNS(_namespace: string, tag: string): FakeElement {
    return new FakeElement(tag, this);
  }

  createTextNode(data: string): {
    readonly nodeType: 3;
    readonly nodeName: "#text";
    readonly data: string;
    readonly textContent: string;
    readonly ownerDocument: FakeDocument;
    parentNode: FakeNode | null;
  } {
    return {
      nodeType: 3,
      nodeName: "#text",
      data,
      textContent: data,
      ownerDocument: this,
      parentNode: null,
    };
  }

  createComment(data: string): {
    readonly nodeType: 8;
    readonly nodeName: "#comment";
    readonly data: string;
    readonly ownerDocument: FakeDocument;
    parentNode: FakeNode | null;
  } {
    return {
      nodeType: 8,
      nodeName: "#comment",
      data,
      ownerDocument: this,
      parentNode: null,
    };
  }
}

class FakeHTMLIFrameElement {
  readonly nodeName = "IFRAME";
}

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  HTMLIFrameElement: FakeHTMLIFrameElement,
  document: new FakeDocument(),
  window: globalThis,
});

type Mounted = {
  latest: () => string;
  rerender: (value: string, delayMs: number) => void;
  unmount: () => void;
};

function mount(value: string, delayMs: number): Mounted {
  const latest = { current: value };
  const container = globalThis.document.createElement("div");
  const root: Root = createRoot(container);

  const render = (nextValue: string, nextDelayMs: number) => {
    act(() => {
      root.render(
        createElement(Probe, {
          value: nextValue,
          delayMs: nextDelayMs,
          latest,
        }),
      );
    });
  };

  render(value, delayMs);

  return {
    latest: () => latest.current,
    rerender: render,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("SEARCH_DEBOUNCE_MS", () => {
  it("is 300", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });
});

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current input on the first render", () => {
    const hooked = mount("cake", SEARCH_DEBOUNCE_MS);
    expect(hooked.latest()).toBe("cake");
    hooked.unmount();
  });

  it("does not update before delayMs on the trailing edge", () => {
    const hooked = mount("cake", SEARCH_DEBOUNCE_MS);
    hooked.rerender("pie", SEARCH_DEBOUNCE_MS);
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(hooked.latest()).toBe("cake");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hooked.latest()).toBe("pie");
    hooked.unmount();
  });

  it("resets the timer when the value changes", () => {
    const hooked = mount("cake", SEARCH_DEBOUNCE_MS);
    hooked.rerender("pie", SEARCH_DEBOUNCE_MS);
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    hooked.rerender("tart", SEARCH_DEBOUNCE_MS);
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(hooked.latest()).toBe("cake");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hooked.latest()).toBe("tart");
    hooked.unmount();
  });

  it("resets the timer when the delay changes", () => {
    const hooked = mount("cake", SEARCH_DEBOUNCE_MS);
    hooked.rerender("pie", SEARCH_DEBOUNCE_MS);
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    hooked.rerender("pie", 100);
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(hooked.latest()).toBe("cake");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hooked.latest()).toBe("pie");
    hooked.unmount();
  });

  it("clears the pending timer on cleanup", () => {
    const hooked = mount("cake", SEARCH_DEBOUNCE_MS);
    hooked.rerender("pie", SEARCH_DEBOUNCE_MS);
    expect(vi.getTimerCount()).toBe(1);
    hooked.unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(hooked.latest()).toBe("cake");
  });
});
