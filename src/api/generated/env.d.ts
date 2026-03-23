// Polyfill DOM types used by hey-api generated client code.
// Node.js has fetch() at runtime but @types/node doesn't expose BodyInit.
type BodyInit = string | ArrayBuffer | Blob | FormData | URLSearchParams | ReadableStream;
