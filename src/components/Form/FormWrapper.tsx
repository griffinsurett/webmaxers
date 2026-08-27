// src/components/Form/FormWrapper.tsx
/**
 * FormWrapper — a single React island that OWNS its fields, so it can do real,
 * accessible validation instead of delegating to native bubbles:
 *
 *   - renders fields from a declarative `fields` config (one shared React tree)
 *   - validates per-field on submit (and re-validates a field on change once it
 *     has an error), setting per-field error text wired via aria-describedby +
 *     aria-invalid (WCAG 3.3.1 / 3.3.3 / 4.1.2)
 *   - moves focus to the first invalid field on a failed submit (3.3.1)
 *   - one always-mounted live region announces submitting / success / error
 *     (4.1.3) — the visible status box reuses the SAME node, no duplication
 *   - aria-busy on the form during submit (4.1.3)
 *
 * Submits via fetch to Formspree so success/error are announced inline and the
 * user (and their screen reader) keep context — no full-page reload.
 */
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Input from "./inputs/Input";
import Textarea from "./inputs/Textarea";
import Select from "./inputs/Select";
import Checkbox from "./inputs/Checkbox";
import Button, { type ButtonVariant } from "@/components/Button/Button";
import { submitToFormspree } from "@/utils/formspree";
import { siteData } from "@/content/siteData";
import { validateField, type FieldConfig } from "./fields";

export interface SubmitButtonConfig {
  text?: string;
  className?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  loadingText?: string;
}

export interface FormWrapperProps {
  /** Declarative field config — FormWrapper renders + validates these. */
  fields: FieldConfig[];
  /** Extra content (hidden inputs, etc.) rendered before the fields. */
  children?: ReactNode;
  /** Grid classes for the fields container (keeps each form's existing layout). */
  fieldsClassName?: string;

  onSubmit?: (values: Record<string, any>) => Promise<void> | void;
  formspreeEndpoint?: string;
  formspreeFormName?: string;
  formspreeExcludeKeys?: string[];
  /**
   * Post the form natively (a real browser submit) instead of via fetch.
   *
   * Required when the Formspree form has reCAPTCHA enabled: Formspree refuses
   * AJAX submissions unless the form also has a custom key, answering with
   * "In order to submit via AJAX, you need to set a custom key or reCAPTCHA
   * must be disabled". A native POST lets Formspree serve its own challenge
   * page and then redirect back via `_next`.
   *
   * Trade-off: the page navigates away, so the inline success/error status is
   * not used — Formspree handles the round trip. Client-side validation still
   * runs first, so users keep the accessible per-field errors.
   */
  useNativeFormSubmission?: boolean;
  /** Method for native submission. */
  formMethod?: "post" | "get";
  /** Return URL after a native submit. Defaults to the current page. */
  reloadOnSuccess?: boolean;

  successMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;

  includeTermsCheckbox?: boolean;
  termsCheckboxLabel?: ReactNode;
  termsCheckboxName?: string;
  privacyPolicyUrl?: string;

  submitButton?: SubmitButtonConfig;
}

type Status = "idle" | "submitting" | "success" | "error";

export default function FormWrapper({
  fields,
  children,
  fieldsClassName = "grid gap-4 md:grid-cols-2",
  onSubmit,
  formspreeEndpoint,
  useNativeFormSubmission = false,
  formMethod = "post",
  reloadOnSuccess,
  formspreeFormName,
  formspreeExcludeKeys = [],
  successMessage = "Thanks — your message has been sent. We'll be in touch shortly.",
  errorMessage = "Something went wrong sending your message. Please try again.",
  loadingMessage = "Sending your message…",
  resetOnSuccess = true,
  className = "",
  onSuccess,
  onError,
  includeTermsCheckbox = true,
  termsCheckboxLabel,
  termsCheckboxName = "terms-agreement",
  privacyPolicyUrl = "/privacy-policy",
  submitButton,
}: FormWrapperProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const shouldUseNativeSubmission =
    useNativeFormSubmission && Boolean(formspreeEndpoint);
  const shouldReloadAfterSuccess = reloadOnSuccess ?? shouldUseNativeSubmission;
  const [status, setStatus] = useState<Status>("idle");
  // Native submission navigates away, so we hand Formspree a `_next` URL to
  // come back to. Read on the client only (window is undefined during SSR).
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && shouldUseNativeSubmission) {
      setCurrentUrl(window.location.href);
    }
  }, [shouldUseNativeSubmission]);
  const [message, setMessage] = useState<string>("");
  // Per-field error map + terms error, keyed by field name.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isSubmitting = status === "submitting";

  const runValidation = (formData: FormData): Record<string, string> => {
    const next: Record<string, string> = {};
    for (const field of fields) {
      const err = validateField(field, formData.get(field.name));
      if (err) next[field.name] = err;
    }
    if (includeTermsCheckbox && formData.get(termsCheckboxName) !== "on") {
      next[termsCheckboxName] =
        "Please confirm you agree before submitting.";
    }
    return next;
  };

  const focusFirstError = (errorMap: Record<string, string>) => {
    const form = formRef.current;
    if (!form) return;
    const firstName = Object.keys(errorMap)[0];
    if (!firstName) return;
    const el = form.querySelector<HTMLElement>(`[name="${firstName}"]`);
    el?.focus();
  };

  // Re-validate a single field on change ONLY after it already showed an error,
  // so the error clears as the user fixes it (never nags before first submit).
  const revalidateField = (name: string) => {
    if (!errors[name] || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const field = fields.find((f) => f.name === name);
    const err = field ? validateField(field, fd.get(name)) : null;
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[name] = err;
      else delete next[name];
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const formData = new FormData(form);

    const validationErrors = runValidation(formData);
    if (Object.keys(validationErrors).length > 0) {
      e.preventDefault();
      setErrors(validationErrors);
      setStatus("error");
      setMessage("Please fix the highlighted fields and try again.");
      // Let the error text render before moving focus.
      requestAnimationFrame(() => focusFirstError(validationErrors));
      return;
    }

    // Native submission: validation passed, so let the browser POST to
    // Formspree for real. Do NOT preventDefault — that is the whole point, and
    // it is what lets Formspree serve its reCAPTCHA challenge.
    if (shouldUseNativeSubmission) {
      setErrors({});
      setStatus("submitting");
      setMessage(loadingMessage);
      return;
    }

    e.preventDefault();

    setErrors({});
    setStatus("submitting");
    setMessage(loadingMessage);

    try {
      const data: Record<string, any> = {};
      formData.forEach((value, key) => {
        const all = formData.getAll(key);
        if (all.length > 1) data[key] = all;
        else if (form.querySelector(`[name="${key}"][type="checkbox"]`))
          data[key] = value === "on";
        else data[key] = value;
      });

      if (onSubmit) {
        await onSubmit(data);
      } else if (formspreeEndpoint) {
        await submitToFormspree({
          endpoint: formspreeEndpoint,
          values: data,
          excludeKeys: formspreeExcludeKeys,
          formName: formspreeFormName,
        });
      } else {
        throw new Error("Form submission handler is not configured.");
      }

      setStatus("success");
      setMessage(successMessage);
      if (resetOnSuccess) form.reset();
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error && err.message ? err.message : errorMessage);
      onError?.(err instanceof Error ? err : new Error("Unknown error"));
    }
  };

  const defaultTermsLabel = (
    <>
      I have read and agree to the{" "}
      <a
        href={privacyPolicyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text hover:underline"
      >
        Privacy Policy
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      , and consent to {siteData.title} contacting me about my inquiry.
    </>
  );

  const renderField = (field: FieldConfig) => {
    const span = field.colSpan === 2 ? "md:col-span-2" : "md:col-span-1";
    const common = {
      name: field.name,
      label: field.label,
      required: field.required,
      error: errors[field.name],
      containerClassName: span,
      autoComplete: field.autoComplete,
      onChange: () => revalidateField(field.name),
    } as const;

    if (field.type === "textarea") {
      return (
        <Textarea
          key={field.name}
          {...common}
          rows={field.rows ?? 5}
          minLength={field.minLength}
        />
      );
    }
    if (field.type === "select") {
      return (
        <Select
          key={field.name}
          {...common}
          options={field.options ?? []}
          placeholder={field.placeholder}
          defaultValue=""
        />
      );
    }
    return (
      <Input
        key={field.name}
        {...common}
        type={field.type ?? "text"}
        minLength={field.minLength}
        pattern={field.pattern}
      />
    );
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // Native submission posts straight to Formspree so it can run its own
      // reCAPTCHA challenge; AJAX mode leaves these unset and uses fetch.
      action={shouldUseNativeSubmission ? formspreeEndpoint : undefined}
      method={shouldUseNativeSubmission ? formMethod : undefined}
      encType={shouldUseNativeSubmission ? "multipart/form-data" : undefined}
      className={className}
      noValidate
      aria-busy={isSubmitting}
    >
      {/* Where Formspree sends the user back to after a native submit. */}
      {shouldUseNativeSubmission && shouldReloadAfterSuccess && currentUrl && (
        <input type="hidden" name="_next" value={currentUrl} />
      )}
      {/* Single always-mounted live region. Errors interrupt (assertive);
          submitting/success are polite. Same node is the visible status box. */}
      {status !== "idle" && message && (
        <div
          role={status === "error" ? "alert" : "status"}
          aria-live={status === "error" ? "assertive" : "polite"}
          className={`p-4 rounded-lg mb-4 border ${
            status === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : status === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-primary/10 text-primary border-primary-200"
          }`}
        >
          <span className="sr-only">
            {status === "error" ? "Error: " : status === "success" ? "Success: " : ""}
          </span>
          {message}
        </div>
      )}

      {children}

      <div className={`relative z-10 ${fieldsClassName}`.trim()}>
        {fields.map(renderField)}
      </div>

      {includeTermsCheckbox && (
        <div className="relative z-10">
          <Checkbox
            name={termsCheckboxName}
            required
            containerClassName="mt-4 mx-1"
            error={errors[termsCheckboxName]}
            onChange={() => revalidateField(termsCheckboxName)}
          >
            {termsCheckboxLabel ?? defaultTermsLabel}
          </Checkbox>
        </div>
      )}

      {submitButton && (
        <div className="mt-6">
          <Button
            type="submit"
            variant={submitButton.variant ?? "primary"}
            disabled={submitButton.disabled}
            aria-disabled={isSubmitting || undefined}
            className={submitButton.className}
          >
            {isSubmitting
              ? (submitButton.loadingText ?? "Sending…")
              : (submitButton.text ?? "Submit")}
          </Button>
        </div>
      )}
    </form>
  );
}