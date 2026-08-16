let verificationPromptHandler = null;

export function setVerificationPromptHandler(handler) {
  verificationPromptHandler = typeof handler === 'function' ? handler : null;
}

/** LOCAL v2 §1 — verified = Şerit A (üni-mail) OR Şerit B (identity KYC); age_ok required when set */
export function isUserVerified(user) {
  if (!user) return false;
  const trackOk = Boolean(user.email_verified || user.identity_verified);
  if (user.age_ok === false) return false;
  return trackOk;
}

export function requireVerifiedUser(user, message, navigation) {
  if (isUserVerified(user)) return true;
  if (navigation?.navigate) {
    navigation.navigate('VerificationRequired', { message });
    return false;
  }
  if (verificationPromptHandler) {
    verificationPromptHandler(
      message || 'Verify your university email or identity to continue.'
    );
  }
  return false;
}
