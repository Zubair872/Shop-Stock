function withWhatsapp(message, whatsapp) {
  const clean = String(whatsapp || "").trim();
  return clean ? `${message} (WhatsApp: ${clean})` : message;
}

export function getEffectiveExpiry(owner) {
  if (!owner) return null;
  if (owner.expiresAt) return new Date(owner.expiresAt);
  if (owner.plan === "trial" && owner.trialEndsAt) return new Date(owner.trialEndsAt);
  return null;
}

export function isAccountExpired(owner, now = new Date()) {
  if (!owner || owner.role === "superadmin" || owner.isDemo) return false;
  const expiry = getEffectiveExpiry(owner);
  return Boolean(expiry && expiry <= now);
}

export function evaluateAccountAccess(owner, now = new Date(), supportWhatsapp = "") {
  if (!owner) {
    return { allowed: false, status: 401, code: "NOT_FOUND", message: "Account nahi mila ya band hai" };
  }
  if (owner.role === "superadmin" || owner.isDemo) {
    return { allowed: true };
  }
  if (owner.isActive === false || owner.status === "suspended") {
    return {
      allowed: false,
      status: 403,
      code: "ACCOUNT_SUSPENDED",
      message: withWhatsapp(
        "Aap ka account suspend kar diya gaya hai, renew ya bahali ke liye rabta karein",
        supportWhatsapp
      ),
    };
  }
  if (isAccountExpired(owner, now)) {
    const base =
      owner.plan === "trial"
        ? "Aap ka trial khatam ho gaya, renew ke liye rabta karein"
        : "Aap ki subscription khatam ho gayi hai, renew ke liye rabta karein";
    return {
      allowed: false,
      status: 403,
      code: owner.plan === "trial" ? "TRIAL_EXPIRED" : "SUBSCRIPTION_EXPIRED",
      message: withWhatsapp(base, supportWhatsapp),
    };
  }
  return { allowed: true };
}
