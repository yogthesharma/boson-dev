import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthForm, AuthKind } from "@/lib/request-form";

const AUTH_OPTIONS: { value: AuthKind; label: string; hint: string }[] = [
  { value: "none", label: "No auth", hint: "no Authorization header is added" },
  { value: "bearer", label: "Bearer token", hint: "Authorization: Bearer …" },
  { value: "basic", label: "Basic auth", hint: "username + password" },
  { value: "api_key", label: "API key", hint: "via header or query string" },
  { value: "oauth2", label: "OAuth 2.0", hint: "static bearer token (for now)" },
];

export function AuthTab({
  auth,
  onChange,
}: {
  auth: AuthForm;
  onChange: (auth: AuthForm) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Auth type
        </Label>
        <Select
          value={auth.kind}
          onValueChange={(value) =>
            onChange({ ...auth, kind: value as AuthKind })
          }
        >
          <SelectTrigger className="h-8 w-fit min-w-[200px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col items-start">
                  <span className="text-sm">{option.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {option.hint}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auth.kind === "bearer" ? (
        <Field label="Token" hint="Use {{secret:NAME}} for encrypted vars.">
          <Input
            value={auth.bearer.token}
            onChange={(event) =>
              onChange({
                ...auth,
                bearer: { token: event.target.value },
              })
            }
            placeholder="{{secret:DEMO_TOKEN}}"
            className="h-9 font-mono text-sm"
          />
        </Field>
      ) : null}

      {auth.kind === "basic" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Username">
            <Input
              value={auth.basic.username}
              onChange={(event) =>
                onChange({
                  ...auth,
                  basic: { ...auth.basic, username: event.target.value },
                })
              }
              placeholder="user"
              className="h-9 font-mono text-sm"
            />
          </Field>
          <Field label="Password">
            <Input
              value={auth.basic.password}
              onChange={(event) =>
                onChange({
                  ...auth,
                  basic: { ...auth.basic, password: event.target.value },
                })
              }
              placeholder="{{secret:PASSWORD}}"
              type="password"
              className="h-9 font-mono text-sm"
            />
          </Field>
        </div>
      ) : null}

      {auth.kind === "api_key" ? (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px]">
          <Field label="Key">
            <Input
              value={auth.apiKey.name}
              onChange={(event) =>
                onChange({
                  ...auth,
                  apiKey: { ...auth.apiKey, name: event.target.value },
                })
              }
              placeholder="x-api-key"
              className="h-9 font-mono text-sm"
            />
          </Field>
          <Field label="Value">
            <Input
              value={auth.apiKey.value}
              onChange={(event) =>
                onChange({
                  ...auth,
                  apiKey: { ...auth.apiKey, value: event.target.value },
                })
              }
              placeholder="{{secret:API_KEY}}"
              className="h-9 font-mono text-sm"
            />
          </Field>
          <Field label="Add to">
            <Select
              value={auth.apiKey.location}
              onValueChange={(location) =>
                onChange({
                  ...auth,
                  apiKey: {
                    ...auth.apiKey,
                    location: location as "header" | "query",
                  },
                })
              }
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : null}

      {auth.kind === "oauth2" ? (
        <Field label="Access token" hint="OAuth flows are not yet automated.">
          <Input
            value={auth.oauth2.token}
            onChange={(event) =>
              onChange({
                ...auth,
                oauth2: { token: event.target.value },
              })
            }
            placeholder="{{secret:OAUTH_TOKEN}}"
            className="h-9 font-mono text-sm"
          />
        </Field>
      ) : null}

      {auth.kind === "none" ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          This request will be sent without an Authorization header.
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
