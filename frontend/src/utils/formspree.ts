// src/utils/formspree.ts
type FormValues = Record<string, unknown>;

interface SubmitToFormspreeParams {
  endpoint: string;
  values: FormValues;
  excludeKeys?: string[];
  formName?: string;
}

interface FormspreeResponse {
  errors?: { message?: string }[];
  error?: string;
  message?: string;
}

export async function submitToFormspree({
  endpoint,
  values,
  excludeKeys = [],
  formName,
}: SubmitToFormspreeParams) {
  if (!endpoint) {
    throw new Error("Form configuration is missing a Formspree endpoint.");
  }

  const sanitizedEntries = Object.entries(values).filter(
    ([key]) => !excludeKeys.includes(key)
  );

  const payload: FormValues = Object.fromEntries(sanitizedEntries);

  if (formName && !payload.formName) {
    payload.formName = formName;
  }

  if (typeof window !== "undefined" && window.location?.href) {
    payload.pageUrl = payload.pageUrl ?? window.location.href;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `Unable to submit the form (status ${response.status}).`;

    try {
      const bodyText = await response.text();
      if (bodyText) {
        try {
          const data = JSON.parse(bodyText) as FormspreeResponse;
          errorMessage =
            data?.errors?.[0]?.message ||
            data?.error ||
            data?.message ||
            errorMessage;
        } catch {
          errorMessage = bodyText;
        }
      }
    } catch {
      // Ignore parse errors
    }

    if (response.status === 403 && errorMessage.includes("status 403")) {
      errorMessage =
        "Formspree rejected this submission (403). Check that the form is active and this domain is allowed in Formspree.";
    }

    throw new Error(errorMessage);
  }
}
