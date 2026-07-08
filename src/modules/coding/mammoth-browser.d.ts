/**
 * mammoth ships a prebuilt browser bundle (`mammoth/mammoth.browser`) with no
 * bundled type declarations. We only use `extractRawText`, so declare the
 * minimal surface we call.
 */
declare module 'mammoth/mammoth.browser' {
  interface ExtractResult {
    value: string
    messages: unknown[]
  }
  interface Mammoth {
    extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>
  }
  const mammoth: Mammoth
  export default mammoth
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>
}
