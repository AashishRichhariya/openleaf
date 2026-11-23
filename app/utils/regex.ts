// Auto-detection patterns (stricter, used when identifying URLs in text)
export const AUTO_DETECTION_URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)(?<![-.+():%])/;

// The two lookbehinds only let a match start where a run of dot-separated words starts. That is
// where the first match always starts anyway, and without them a long word takes quadratic time.
// A quoted name ends at the next quote, which also keeps time linear.
export const AUTO_DETECTION_EMAIL_REGEX =
  /(((?<![^<>()[\]\\.,;:\s@"])(?<![^<>()[\]\\.,;:\s@"]\.)[^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|("[^"\n]+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

// Validation pattern (more permissive, used when checking manually entered URLs). It only says
// whether text contains a URL: a scheme, www. or user@host. So it looks at no more characters
// than that takes, as matching the whole URL took quadratic time.
export const URL_VALIDATION_REGEX =
  /[A-Za-z]{3}:(?:\/\/)?[A-Za-z0-9.-]|www.[A-Za-z0-9.-]|[-;:&=+$,\w]@[A-Za-z0-9.-]/;

// Phone number detection pattern
export const PHONE_NUMBER_REGEX = /^\+?[0-9\s()\-]{5,}$/;
