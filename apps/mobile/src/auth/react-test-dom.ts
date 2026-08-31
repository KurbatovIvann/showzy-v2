/**
 * Minimal document so `react-dom/client` can mount hook probes in vitest.
 * Copied from `src/hooks/use-debounced-value.test.ts`. App code must not
 * import this file.
 */
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
