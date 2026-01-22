// Minimal type shims so TypeScript tooling doesn't error on Supabase Edge Functions
// (these run in Deno, not in the Vite/TS browser build).

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  // Keep typings loose; runtime is provided by Edge.
  export function createClient(...args: any[]): any;
}

declare module "https://esm.sh/resend@2.0.0" {
  export class Resend {
    constructor(apiKey?: string);
    emails: {
      send: (args: any) => Promise<any>;
    };
  }
}
