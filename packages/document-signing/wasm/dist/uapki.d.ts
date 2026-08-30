interface UapkiModuleOptions {
  locateFile?: (path: string, prefix: string) => string;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
}

interface UapkiModule {
  ccall: (
    name: string,
    returnType: string,
    argTypes: string[],
    args: unknown[],
  ) => unknown;
  cwrap: (
    name: string,
    returnType: string,
    argTypes: string[],
  ) => (...args: unknown[]) => unknown;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, ptr: number, maxLen: number) => void;
  lengthBytesUTF8: (str: string) => number;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  HEAPU8: Uint8Array;
  FS: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  _process: (jsonPtr: number) => number;
  _json_free: (ptr: number) => void;
  _set_cors_proxy_url: (urlPtr: number) => void;
}

declare function createUapkiModule(
  options?: UapkiModuleOptions,
): Promise<UapkiModule>;

export default createUapkiModule;
export { UapkiModule, UapkiModuleOptions };
