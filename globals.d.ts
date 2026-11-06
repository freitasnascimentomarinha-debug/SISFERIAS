/** Versão do sistema (package.json), definida em vite.config.ts. */
declare const __APP_VERSION__: string;

declare module '*.png' {
  const url: string;
  export default url;
}
