/// <reference types="vitest/globals" />

declare namespace JSX {
  interface IntrinsicElements {
    "mentor-ai": any; // You can replace 'any' with a more specific type if you have one
  }
}

interface Window {
  __ENV__: { [key: string]: string | undefined }; // Define the structure of __ENV__
  
  // Third-party services
  Dropbox: any;
  OneDrive: any;
  gapi: any;
}
